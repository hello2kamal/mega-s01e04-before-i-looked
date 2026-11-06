import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { readNight, summaryOf } from '../src/digest/reader.js';

const fixtures = fileURLToPath(new URL('../runs/', import.meta.url));
const night = '2026-10-28';
const temporaryDirs: string[] = [];

function runsDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-digest-reader-'));
  temporaryDirs.push(dir);
  return dir;
}

function entry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { at: '2026-10-28T10:00:00+01:00', job: 'lane/sync', status: 'ok', owner: 'rook', ...overrides };
}

afterEach(() => {
  for (const dir of temporaryDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('readNight', () => {
  it('aggregates the October 28 fixture and preserves retries, errors, null owner and offsets', () => {
    const digest = readNight(fixtures, night);
    expect(digest).not.toBeNull();
    expect(digest?.badLines).toBe(1);
    expect(digest?.rows.map(({ job }) => job)).toEqual([
      'digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup', 'rig/rotate-logs',
    ]);
    expect(digest?.rows.find(({ job }) => job === 'fixtures/refresh')).toEqual({
      job: 'fixtures/refresh', owner: 'rook', runs: 4, retries: 3, lastStatus: 'ok',
      lastError: 'upstream 503', firstAt: '2026-10-29T01:30:00+01:00', lastAt: '2026-10-29T01:37:00+01:00',
    });
    expect(digest?.rows.find(({ job }) => job === 'lane/sync')).toMatchObject({
      runs: 8, retries: 1, lastStatus: 'ok', lastError: 'lock held',
    });
    expect(digest?.rows.find(({ job }) => job === 'digest/render')?.owner).toBeNull();
    expect(summaryOf(digest?.rows ?? [])).toEqual({ totalJobs: 5, success: 4, failure: 1, retry: 0 });
  });

  it('reads the October 27 fixture as four successful jobs', () => {
    const digest = readNight(fixtures, '2026-10-27');
    expect(digest?.badLines).toBe(0);
    expect(summaryOf(digest?.rows ?? [])).toEqual({ totalJobs: 4, success: 4, failure: 0, retry: 0 });
    expect(digest?.rows.find(({ job }) => job === 'lane/sync')?.runs).toBe(4);
  });

  it('compares instants across offsets and out-of-order records, keeping the latest reported error', () => {
    const dir = runsDir();
    const entries = [
      entry({ at: '2026-10-28T10:15:00+01:00', status: 'retry', error: 'latest error' }),
      entry({ at: '2026-10-28T11:00:00+02:00', status: 'fail', owner: 'earlier', error: 'older error' }),
      entry({ at: '2026-10-28T09:30:00Z', owner: null }),
      entry({ at: '2026-10-28T10:05:00+01:00', status: 'retry', error: 'middle error' }),
    ];
    writeFileSync(join(dir, `${night}.jsonl`), entries.map((value) => JSON.stringify(value)).join('\r\n') + '\r\n');
    expect(readNight(dir, night)).toEqual({
      night, badLines: 0, rows: [{
        job: 'lane/sync', owner: null, runs: 4, retries: 2, lastStatus: 'ok', lastError: 'latest error',
        firstAt: '2026-10-28T11:00:00+02:00', lastAt: '2026-10-28T09:30:00Z',
      }],
    });
  });

  it('uses later file records to break equal-instant ties', () => {
    const dir = runsDir();
    writeFileSync(join(dir, `${night}.jsonl`), [
      entry({ status: 'fail', error: 'first error' }),
      entry({ at: '2026-10-28T09:00:00Z', owner: null, status: 'retry', error: 'last error' }),
    ].map((value) => JSON.stringify(value)).join('\n'));
    expect(readNight(dir, night)?.rows[0]).toMatchObject({
      runs: 2, retries: 1, owner: null, lastStatus: 'retry', lastError: 'last error', lastAt: '2026-10-28T09:00:00Z',
    });
  });

  it('counts malformed JSON and invalid schema lines without dropping valid neighboring records', () => {
    const dir = runsDir();
    const missingOwner = entry();
    delete missingOwner.owner;
    const invalidValues: unknown[] = [
      null, [], 'text', 42, {}, missingOwner,
      entry({ at: 123 }), entry({ at: 'not-a-time' }), entry({ at: '2026-10-28' }),
      entry({ at: '2026-02-30T10:00:00Z' }), entry({ at: '2026-10-28T25:00:00Z' }),
      entry({ at: '2026-10-28T10:00:00+25:00' }), entry({ at: '2026-10-28T10:00:00' }),
      entry({ job: null }), entry({ job: ' ' }), entry({ status: 'unknown' }),
      entry({ owner: 3 }), entry({ error: null }), entry({ error: {} }),
    ];
    const lines = [JSON.stringify(entry()), '{broken', '', ...invalidValues.map((value) => JSON.stringify(value)), JSON.stringify(entry())];
    writeFileSync(join(dir, `${night}.jsonl`), lines.join('\n'));
    const digest = readNight(dir, night);
    expect(digest?.badLines).toBe(invalidValues.length + 2);
    expect(digest?.rows).toHaveLength(1);
    expect(digest?.rows[0].runs).toBe(2);
  });

  it('distinguishes an empty file from a missing file', () => {
    const dir = runsDir();
    expect(readNight(dir, night)).toBeNull();
    writeFileSync(join(dir, `${night}.jsonl`), '');
    expect(readNight(dir, night)).toEqual({ night, rows: [], badLines: 0 });
  });

  it('rejects invalid night filenames before accessing disk', () => {
    const dir = runsDir();
    writeFileSync(join(dir, `${night}\n.jsonl`), JSON.stringify(entry()));
    for (const invalid of ['../2026-10-28', '2026-10-28/extra', '2026-1-1', '2026-10-28.jsonl', '2026-10-28\n']) {
      expect(readNight(dir, invalid)).toBeNull();
    }
  });

  it('propagates filesystem errors other than ENOENT', () => {
    const dir = runsDir();
    mkdirSync(join(dir, `${night}.jsonl`));
    expect(() => readNight(dir, night)).toThrow();
  });
});

describe('summaryOf', () => {
  it('counts each final status once while retaining previous retry counts', () => {
    const digest = readNight(fixtures, night);
    const row = digest?.rows[0];
    expect(row).toBeDefined();
    if (!row) throw new Error('fixture must contain a job');
    const rows = [
      { ...row, job: 'success', lastStatus: 'ok' as const, retries: 3 },
      { ...row, job: 'failure', lastStatus: 'fail' as const },
      { ...row, job: 'retrying', lastStatus: 'retry' as const },
    ];
    const summary = summaryOf(rows);
    expect(summary).toEqual({ totalJobs: 3, success: 1, failure: 1, retry: 1 });
    expect(summary.success + summary.failure + summary.retry).toBe(summary.totalJobs);
    expect(rows[0].retries).toBe(3);
    expect(summaryOf([])).toEqual({ totalJobs: 0, success: 0, failure: 0, retry: 0 });
  });
});
