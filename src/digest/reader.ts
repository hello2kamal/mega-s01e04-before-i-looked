import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, DigestStatus, DigestSummary, NightDigest } from './types.js';

type RunEntry = {
  at: string;
  instant: number;
  job: string;
  status: DigestStatus;
  owner: string | null;
  error?: string;
};

type JobHistory = {
  row: DigestRow;
  firstInstant: number;
  lastInstant: number;
  errorInstant: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function timestampOf(value: string): number | null {
  // A logged instant needs a timezone; retain this string for display after comparison.
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!parts || parts[0] !== value) return null;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, offset] = parts;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) return null;
  if (Number(hourText) > 23 || Number(minuteText) > 59 || Number(secondText) > 59) return null;
  if (offset !== 'Z' && (Number(offset.slice(1, 3)) > 23 || Number(offset.slice(4)) > 59)) return null;
  const instant = Date.parse(value);
  return Number.isFinite(instant) ? instant : null;
}

function parseEntry(line: string): RunEntry | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;
  const { at, job, status, owner, error } = value;
  if (typeof at !== 'string' || typeof job !== 'string' || job.trim().length === 0) return null;
  if (status !== 'ok' && status !== 'retry' && status !== 'fail') return null;
  if (owner !== null && typeof owner !== 'string') return null;
  if ('error' in value && typeof error !== 'string') return null;
  const instant = timestampOf(at);
  if (instant === null) return null;
  return { at, instant, job, status, owner, ...(typeof error === 'string' ? { error } : {}) };
}

export function readNight(runsDir: string, night: string): NightDigest | null {
  if (night.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(night)) return null;
  let content: string;
  try {
    content = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
  const histories = new Map<string, JobHistory>();
  let badLines = 0;
  const lines = content === '' ? [] : content.split(/\r?\n/);
  // The line terminator after the last record does not introduce another record.
  if (lines.at(-1) === '') lines.pop();
  for (const line of lines) {
    const entry = parseEntry(line);
    if (!entry) {
      badLines += 1;
      continue;
    }
    const history = histories.get(entry.job);
    if (!history) {
      histories.set(entry.job, {
        row: {
          job: entry.job,
          owner: entry.owner,
          runs: 1,
          retries: entry.status === 'retry' ? 1 : 0,
          lastStatus: entry.status,
          lastError: entry.error ?? null,
          firstAt: entry.at,
          lastAt: entry.at,
        },
        firstInstant: entry.instant,
        lastInstant: entry.instant,
        errorInstant: entry.error === undefined ? null : entry.instant,
      });
      continue;
    }
    const { row } = history;
    row.runs += 1;
    if (entry.status === 'retry') row.retries += 1;
    if (entry.instant < history.firstInstant) {
      row.firstAt = entry.at;
      history.firstInstant = entry.instant;
    }
    // For equal instants, the later record in the file wins.
    if (entry.instant >= history.lastInstant) {
      row.lastAt = entry.at;
      row.lastStatus = entry.status;
      row.owner = entry.owner;
      history.lastInstant = entry.instant;
    }
    if (entry.error !== undefined && (history.errorInstant === null || entry.instant >= history.errorInstant)) {
      row.lastError = entry.error;
      history.errorInstant = entry.instant;
    }
  }
  const rows = [...histories.values()].map(({ row }) => row);
  rows.sort((a, b) => a.job < b.job ? -1 : a.job > b.job ? 1 : 0);
  return { night, rows, badLines };
}

export function summaryOf(rows: readonly DigestRow[]): DigestSummary {
  const summary: DigestSummary = { totalJobs: rows.length, success: 0, failure: 0, retry: 0 };
  for (const row of rows) {
    if (row.lastStatus === 'ok') summary.success += 1;
    else if (row.lastStatus === 'fail') summary.failure += 1;
    else summary.retry += 1;
  }
  return summary;
}
