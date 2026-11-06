import { describe, expect, it } from 'vitest';
import { retryActivityOf } from '../src/digest/activity.js';
import type { DigestRow } from '../src/digest/types.js';

function row(job: string, retries: number): DigestRow {
  return {
    job,
    owner: 'rook',
    runs: retries + 1,
    retries,
    lastStatus: 'ok',
    lastError: null,
    firstAt: '2026-11-04T08:00:00-05:00',
    lastAt: '2026-11-04T08:01:00-05:00',
  };
}

describe('retryActivityOf', () => {
  it('sums retry attempts and sorts retried jobs by attempts, then job name', () => {
    const rows = [row('zulu/job', 4), row('beta/job', 2), row('alpha/job', 4), row('no-retries', 0)];

    expect(retryActivityOf(rows)).toEqual({
      retryAttempts: 10,
      jobsRetried: 3,
      jobs: [
        { job: 'alpha/job', attempts: 4 },
        { job: 'zulu/job', attempts: 4 },
        { job: 'beta/job', attempts: 2 },
      ],
    });
  });

  it('returns a zero-safe result for empty input and rows with no retries', () => {
    expect(retryActivityOf([])).toEqual({ retryAttempts: 0, jobsRetried: 0, jobs: [] });
    expect(retryActivityOf([row('one', 0), row('two', 0)])).toEqual({
      retryAttempts: 0,
      jobsRetried: 0,
      jobs: [],
    });
  });

  it('does not mutate the digest rows it summarizes', () => {
    const rows = [row('zulu/job', 2), row('alpha/job', 1)];
    const before = structuredClone(rows);

    retryActivityOf(rows);

    expect(rows).toEqual(before);
  });
});
