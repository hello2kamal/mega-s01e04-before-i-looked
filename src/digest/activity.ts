import type { DigestRow } from './types.js';

export type RetryActivity = {
  retryAttempts: number;
  jobsRetried: number;
  jobs: Array<{ job: string; attempts: number }>;
};

/** Summarize retry entries independently from each job's final status. */
export function retryActivityOf(rows: readonly DigestRow[]): RetryActivity {
  const jobs = rows
    .filter((row) => row.retries > 0)
    .map((row) => ({ job: row.job, attempts: row.retries }))
    .sort((a, b) => b.attempts - a.attempts || (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));

  return {
    retryAttempts: jobs.reduce((total, row) => total + row.attempts, 0),
    jobsRetried: jobs.length,
    jobs,
  };
}
