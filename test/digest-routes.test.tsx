import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { NightDigest } from '../src/digest/types.js';

const temporaryDirs: string[] = [];
const night = '2026-11-04';
const sampleRuns = fileURLToPath(new URL('../runs/', import.meta.url));

function makeRunsDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
  temporaryDirs.push(dir);
  return dir;
}

function appFor(runsDir: string) {
  return createApp({
    adapter: 'test-adapter',
    installed: '2026-11-01T09:00:00-05:00',
    beatEverySeconds: 60,
    runsDir,
  });
}

function writeNight(runsDir: string, filename: string, lines: string[]): void {
  writeFileSync(join(runsDir, `${filename}.jsonl`), lines.join('\n'));
}

function entry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    at: '2026-11-04T08:00:00-05:00',
    job: 'job/default',
    status: 'ok',
    owner: 'rook',
    ...overrides,
  };
}

function mainTableJobs(html: string): string[] {
  const table = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? '';
  return [...table.matchAll(/<tr\b[^>]*>\s*<td\b[^>]*>([\s\S]*?)<\/td>/g)]
    .map((match) => match[1].replace(/<[^>]*>/g, '').trim());
}

function visibleText(html: string): string {
  return html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim();
}

afterEach(() => {
  for (const dir of temporaryDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('digest routes', () => {
  it('serves matching HTML and JSON rows with final outcomes and historical retry activity', async () => {
    const runsDir = makeRunsDir();
    writeNight(runsDir, night, [
      JSON.stringify(entry({ at: '2026-11-04T08:00:00-05:00', job: 'alpha/retried-success', status: 'retry', error: 'temporary issue' })),
      JSON.stringify(entry({ at: '2026-11-04T08:01:00-05:00', job: 'alpha/retried-success', status: 'retry', error: 'still retrying' })),
      JSON.stringify(entry({ at: '2026-11-04T08:02:00-05:00', job: 'alpha/retried-success', status: 'retry', error: 'third retry' })),
      JSON.stringify(entry({ at: '2026-11-04T08:03:00-05:00', job: 'alpha/retried-success', status: 'ok', owner: null })),
      JSON.stringify(entry({ at: '2026-11-04T08:04:00-05:00', job: 'bravo/final-retry', status: 'retry', error: 'waiting for source' })),
      JSON.stringify(entry({ at: '2026-11-04T08:05:00-05:00', job: 'charlie/failure', status: 'fail', error: 'source failed' })),
    ]);
    const app = appFor(runsDir);

    const [htmlResponse, jsonResponse] = await Promise.all([
      app.request(`/digest/${night}`),
      app.request(`/api/digest/${night}`),
    ]);
    const html = await htmlResponse.text();
    const digest = await jsonResponse.json() as NightDigest;

    expect(htmlResponse.status).toBe(200);
    expect(jsonResponse.status).toBe(200);
    expect(digest).toMatchObject({ night, badLines: 0 });
    expect(digest.rows.map(({ job }) => job)).toEqual([
      'alpha/retried-success', 'bravo/final-retry', 'charlie/failure',
    ]);
    expect(mainTableJobs(html)).toEqual(digest.rows.map(({ job }) => job));
    expect(html).toContain('aria-label="Latest status across 3 jobs: 1 success, 1 failure, 1 retry"');
    expect(html).toContain('aria-label="Retry activity: 4 attempts across 2 jobs"');
    const text = visibleText(html);
    expect(text).toMatch(/\bTotal jobs\s+3\b/);
    expect(text).toMatch(/\bSuccessful jobs\s+1\b/);
    expect(text).toMatch(/\bFailed jobs\s+1\b/);
    expect(text).toMatch(/\bRetry attempts\s+4\b/);
    expect(text).toMatch(/\bAcross 2 jobs with retries\b/);
    expect(digest.rows[0]).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok', owner: null });
    expect(digest.rows[1]).toMatchObject({ retries: 1, lastStatus: 'retry' });
    expect(mainTableJobs(html)).toContain('alpha/retried-success');
    expect(text).toContain('—');
    expect(text).toContain('fail');
    expect(html).toContain('2026-11-04T08:00:00-05:00');
    expect(html).toContain('2026-11-04T08:03:00-05:00');
    expect(digest.rows[0].firstAt).toBe('2026-11-04T08:00:00-05:00');
    expect(digest.rows[0].lastAt).toBe('2026-11-04T08:03:00-05:00');
    expect(html).not.toMatch(/<script\b/i);
    expect(html).not.toMatch(/<link\b/i);
    expect(html).not.toMatch(/<img\b/i);
    expect(html).not.toMatch(/\son[a-z]+=/i);
    expect(html).toContain('<style>');
  });

  it('shows October 28 recovered retry attempts separately from final job outcomes', async () => {
    const runsDir = makeRunsDir();
    copyFileSync(join(sampleRuns, '2026-10-28.jsonl'), join(runsDir, '2026-10-28.jsonl'));
    const app = appFor(runsDir);

    const [htmlResponse, jsonResponse] = await Promise.all([
      app.request('/digest/2026-10-28'),
      app.request('/api/digest/2026-10-28'),
    ]);
    const html = await htmlResponse.text();
    const digest = await jsonResponse.json() as NightDigest;
    const text = visibleText(html);

    expect(htmlResponse.status).toBe(200);
    expect(jsonResponse.status).toBe(200);
    expect(digest.rows).toHaveLength(5);
    expect(digest.rows.filter(({ lastStatus }) => lastStatus === 'ok')).toHaveLength(4);
    expect(digest.rows.filter(({ lastStatus }) => lastStatus === 'fail')).toHaveLength(1);
    expect(digest.rows.filter(({ lastStatus }) => lastStatus === 'retry')).toHaveLength(0);
    expect(html).toContain('aria-label="Latest status across 5 jobs: 4 success, 1 failure, 0 retry"');
    expect(html).toContain('aria-label="Retry activity: 4 attempts across 2 jobs"');
    expect(text).toMatch(/\bTotal jobs\s+5\b/);
    expect(text).toMatch(/\bSuccessful jobs\s+4\b/);
    expect(text).toMatch(/\bFailed jobs\s+1\b/);
    expect(text).toMatch(/\bRetry attempts\s+4\b/);
    expect(text).toMatch(/\bAcross 2 jobs with retries\b/);
    expect(digest.rows.find(({ job }) => job === 'fixtures/refresh')?.retries).toBe(3);
    expect(digest.rows.find(({ job }) => job === 'lane/sync')?.retries).toBe(1);
  });

  it('returns 404 for missing and invalid nights on both endpoints', async () => {
    const app = appFor(makeRunsDir());
    for (const path of ['/digest/2026-11-04', '/api/digest/2026-11-04']) {
      expect((await app.request(path)).status).toBe(404);
    }
    for (const path of ['/digest/not-a-night', '/api/digest/not-a-night']) {
      expect((await app.request(path)).status).toBe(404);
    }
  });

  it('renders an empty night with nothing ran and a zero-safe overview', async () => {
    const runsDir = makeRunsDir();
    writeNight(runsDir, night, []);
    const app = appFor(runsDir);

    const [htmlResponse, jsonResponse] = await Promise.all([
      app.request(`/digest/${night}`),
      app.request(`/api/digest/${night}`),
    ]);
    const html = await htmlResponse.text();
    const digest = await jsonResponse.json() as NightDigest;

    expect(htmlResponse.status).toBe(200);
    expect(jsonResponse.status).toBe(200);
    expect(html).toContain('nothing ran');
    expect(html).toContain('Latest status across 0 jobs: 0 success, 0 failure, 0 retry');
    expect(visibleText(html)).toMatch(/\bRetry attempts\s+0\b/);
    expect(visibleText(html)).toContain('No retry attempts recorded.');
    expect(digest).toEqual({ night, rows: [], badLines: 0 });
  });

  it('counts malformed lines while keeping valid neighboring rows and reports the count in HTML', async () => {
    const runsDir = makeRunsDir();
    writeNight(runsDir, night, [
      JSON.stringify(entry({ job: 'valid/first' })),
      '{broken json',
      JSON.stringify(entry({ job: 'valid/second', status: 'fail' })),
      JSON.stringify({ at: 'not-a-time', job: 'invalid/time', status: 'ok', owner: 'rook' }),
    ]);
    const app = appFor(runsDir);

    const [htmlResponse, jsonResponse] = await Promise.all([
      app.request(`/digest/${night}`),
      app.request(`/api/digest/${night}`),
    ]);
    const html = await htmlResponse.text();
    const digest = await jsonResponse.json() as NightDigest;

    expect(digest.badLines).toBe(2);
    expect(digest.rows.map(({ job }) => job)).toEqual(['valid/first', 'valid/second']);
    expect(html).toContain('Malformed log lines skipped: 2.');
    expect(mainTableJobs(html)).toEqual(digest.rows.map(({ job }) => job));
  });

  it('distinguishes an all-malformed night from an empty file', async () => {
    const runsDir = makeRunsDir();
    writeNight(runsDir, night, ['{broken json', JSON.stringify({ ...entry(), status: 'unknown' })]);
    const app = appFor(runsDir);

    const [htmlResponse, jsonResponse] = await Promise.all([
      app.request(`/digest/${night}`),
      app.request(`/api/digest/${night}`),
    ]);
    const html = await htmlResponse.text();
    const digest = await jsonResponse.json() as NightDigest;

    expect(digest).toEqual({ night, rows: [], badLines: 2 });
    expect(html).toContain('No valid jobs could be read.');
    expect(html).not.toContain('nothing ran');
    expect(html).toContain('Malformed log lines skipped: 2.');
    expect(visibleText(html)).toContain('No retry attempts recorded.');
  });

  it('escapes untrusted job and error strings in HTML while retaining them in JSON', async () => {
    const runsDir = makeRunsDir();
    const maliciousJob = '<img src=x onerror="alert(1)">';
    const maliciousError = '</td><script>alert("x")</script>';
    writeNight(runsDir, night, [JSON.stringify(entry({ job: maliciousJob, status: 'fail', error: maliciousError }))]);
    const app = appFor(runsDir);

    const [htmlResponse, jsonResponse] = await Promise.all([
      app.request(`/digest/${night}`),
      app.request(`/api/digest/${night}`),
    ]);
    const html = await htmlResponse.text();
    const digest = await jsonResponse.json() as NightDigest;

    expect(digest.rows[0]).toMatchObject({ job: maliciousJob, lastError: maliciousError });
    expect(html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    expect(html).toContain('&lt;/td&gt;&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(html).not.toMatch(/<img\b/i);
    expect(html).not.toMatch(/<script\b/i);
    expect(html).not.toMatch(/<[^>]+\sonerror=/i);
  });

  it('links each discovered board night to its digest with latest-status counts and keeps health available', async () => {
    const runsDir = makeRunsDir();
    writeNight(runsDir, '2026-11-03', [
      JSON.stringify(entry({ job: 'board/ok', status: 'ok' })),
      JSON.stringify(entry({ job: 'board/retry', status: 'retry' })),
    ]);
    writeNight(runsDir, '2026-11-04', [
      JSON.stringify(entry({ job: 'board/fail', status: 'fail' })),
      JSON.stringify(entry({ job: 'board/success', status: 'ok' })),
      JSON.stringify(entry({ job: 'board/retry', status: 'retry' })),
    ]);
    const app = appFor(runsDir);

    const boardResponse = await app.request('/');
    const board = await boardResponse.text();
    expect(boardResponse.status).toBe(200);
    expect(board).toContain('<a href="/digest/2026-11-04">2026-11-04</a> · ok 1 · retry 1 · fail 1');
    expect(board).toContain('<a href="/digest/2026-11-03">2026-11-03</a> · ok 1 · retry 1 · fail 0');
    expect((await app.request('/digest/2026-11-04')).status).toBe(200);
    expect((await app.request('/digest/2026-11-03')).status).toBe(200);

    const healthResponse = await app.request('/health');
    expect(healthResponse.status).toBe(200);
    expect(await healthResponse.json()).toEqual({ ok: true, lane: 'lane-07' });
  });
});
