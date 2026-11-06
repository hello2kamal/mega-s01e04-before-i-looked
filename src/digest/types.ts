export type DigestStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  owner: string | null;
  /** All valid log entries for this job, including retries. */
  runs: number;
  /** Valid entries whose status is retry, even if the job later succeeds. */
  retries: number;
  lastStatus: DigestStatus;
  /** Most recent error reported for this job, or null if no error was ever reported. */
  lastError: string | null;
  /** Original timestamp strings, including their logged offsets. */
  firstAt: string;
  lastAt: string;
};

export type NightDigest = {
  night: string;
  /** One row per job, sorted by job ascending. */
  rows: DigestRow[];
  badLines: number;
};

/** Implemented as readNight in reader.ts: null for a missing file; empty rows for an empty file. */
export type ReadNight = (runsDir: string, night: string) => NightDigest | null;

/** Mutually exclusive job counts based only on each row's lastStatus. */
export type DigestSummary = {
  totalJobs: number;
  success: number;
  failure: number;
  retry: number;
};

/** Implemented as summaryOf in reader.ts; success + failure + retry equals totalJobs. */
export type SummaryOf = (rows: readonly DigestRow[]) => DigestSummary;
