import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { lastBeat, type Beat } from './heartbeat.js';
import { readNight, summaryOf } from './digest/reader.js';
import type { DigestSummary } from './digest/types.js';

export type NightStatus = {
  night: string;
  summary: DigestSummary | null;
};

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: string[];
  nightSummaries: NightStatus[];
};

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function readStatus(config: RigConfig): Status {
  const nights = nightsOnDisk(config.runsDir);
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights,
    nightSummaries: nights.map((night) => {
      const digest = readNight(config.runsDir, night);
      return { night, summary: digest ? summaryOf(digest.rows) : null };
    }),
  };
}
