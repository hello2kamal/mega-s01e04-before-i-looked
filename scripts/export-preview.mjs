#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { constants } from 'node:fs';
import { access, mkdir, realpath, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_URL = 'http://127.0.0.1:8787/digest/2026-10-28';
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');

function usage() {
  console.error('Usage: node scripts/export-preview.mjs <output.html> [local-url]');
  process.exit(2);
}

function worktreeRoots() {
  const roots = new Set([repoRoot]);
  try {
    const output = execFileSync('git', ['-C', repoRoot, 'worktree', 'list', '--porcelain'], { encoding: 'utf8' });
    for (const line of output.split(/\r?\n/)) {
      if (line.startsWith('worktree ')) roots.add(path.resolve(line.slice('worktree '.length)));
    }
  } catch {
    // The script still protects the current worktree and any repo discoverable from the output path.
  }
  return [...roots];
}

async function canonicalPath(filePath) {
  const absolute = path.resolve(filePath);
  let existing = absolute;
  const missing = [];
  while (true) {
    try {
      await access(existing, constants.F_OK);
      break;
    } catch {
      const parent = path.dirname(existing);
      if (parent === existing) throw new Error(`Cannot resolve output path: ${absolute}`);
      missing.unshift(path.basename(existing));
      existing = parent;
    }
  }
  const resolvedExisting = await realpath(existing);
  return path.join(resolvedExisting, ...missing);
}

function isWithin(candidate, root) {
  const rel = path.relative(root, candidate);
  return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel));
}

async function rejectRepositoryOutput(outputPath) {
  const canonical = await canonicalPath(outputPath);
  const knownRoots = worktreeRoots();
  for (const root of knownRoots) {
    const realRoot = await realpath(root).catch(() => root);
    if (isWithin(canonical, realRoot)) throw new Error(`Refusing to write inside Git worktree: ${realRoot}`);
  }

  // Also find a repository that contains the requested destination, even when it is not
  // a registered worktree of this repository.
  let directory = path.dirname(canonical);
  while (true) {
    const marker = path.join(directory, '.git');
    try {
      await stat(marker);
      const realRoot = await realpath(directory).catch(() => directory);
      if (knownRoots.some((root) => isWithin(canonical, path.resolve(root)))) {
        throw new Error(`Refusing to write inside Git worktree: ${realRoot}`);
      }
      // A containing workspace may host isolated child worktrees. Allow output there only
      // when that workspace's own ignore rules exclude the artifact from Git.
      try {
        execFileSync('git', ['-C', realRoot, 'check-ignore', '-q', '--', canonical], { stdio: 'ignore' });
      } catch {
        throw new Error(`Refusing to write inside a Git repository unless ignored: ${realRoot}`);
      }
      break;
    } catch (error) {
      if (error?.message?.startsWith('Refusing to write')) throw error;
    }
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return canonical;
}

function validateHtml(html) {
  if (!/^\s*<!doctype\s+html\b/i.test(html)) throw new Error('Response is not an HTML document with a doctype.');
  if (/<\s*script\b/i.test(html)) throw new Error('Refusing HTML containing client scripts.');
  if (/<\s*link\b[^>]*\brel\s*=\s*(?:"[^"]*\bstylesheet\b[^"]*"|'[^']*\bstylesheet\b[^']*'|stylesheet\b)/i.test(html)) {
    throw new Error('Refusing HTML containing an external stylesheet link.');
  }
  if (/<style\b[^>]*>[\s\S]*?@import\s+(?:url\()?\s*["']?https?:/i.test(html)) {
    throw new Error('Refusing HTML importing an external stylesheet.');
  }
}

if (process.argv.length < 3 || process.argv.length > 4) usage();
const requestedOutput = process.argv[2];
const sourceUrl = process.argv[3] ?? DEFAULT_URL;
let parsedUrl;
try {
  parsedUrl = new URL(sourceUrl);
} catch {
  throw new Error('Source URL must be a valid local HTTP URL.');
}
if (parsedUrl.protocol !== 'http:' || !['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsedUrl.hostname)) {
  throw new Error('Source URL must use HTTP on localhost or a loopback address.');
}

const outputPath = await rejectRepositoryOutput(requestedOutput);
const response = await fetch(parsedUrl, { redirect: 'error' });
if (!response.ok) throw new Error(`Source returned HTTP ${response.status}.`);
const contentType = response.headers.get('content-type') ?? '';
if (!/^text\/html(?:\s*;|\s*$)/i.test(contentType)) throw new Error(`Expected text/html response; received ${contentType || 'no content type'}.`);
const html = await response.text();
validateHtml(html);
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, html, { encoding: 'utf8' });
const bytes = Buffer.byteLength(html, 'utf8');
console.log(`Exported ${bytes} bytes to ${outputPath}`);
