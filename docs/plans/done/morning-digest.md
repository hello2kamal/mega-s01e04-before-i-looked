---
plan: morning-digest
status: ready
owner: rook
opened: 2026-10-29
---

# Morning digest

The night's run log is a JSONL file nobody reads. By breakfast someone has to know what ran,
what retried, what failed, and whose it was, without opening `runs/`. rig already serves the
status board; the digest is one more page on it.

Out of scope: notifications, history across nights, auth (rig only listens on localhost).

## 1. Run log reader

Read `runs/<night>.jsonl` into one row per job: job, owner, runs, retries, last status, last
error, first and last time. One JSON object per line (`at`, `job`, `status`: `ok | retry | fail`,
`owner`, optional `error`).

- A line that doesn't parse is counted, never thrown. The night still renders.
- `owner` can be `null`. Keep the row; show the owner as `—`.
- Lives in `src/digest/`. Commit `src/digest/types.ts` first (the `DigestRow` type and the
  `readNight(runsDir, night)` signature), so every part of section 2 can start against it.

Done when: reader tests pass on `runs/2026-10-28.jsonl` (5 jobs, 1 bad line).

## 2. Digest page

Four small parts. Each needs only `src/digest/types.ts` from section 1, so once that is in they
can go to four workers at once. Small, well-specified work: a cheaper model is fine here.

### 2a. Page

`GET /digest/:night` renders the rows with the usual layout: one table, sorted by job, retries of
3 or more and any `fail` marked. A night with no file returns 404; an empty file renders
"nothing ran".

Done when: `/digest/2026-10-28` renders locally.

User-approved addition: put an overview above the detail table: total distinct jobs and a
contemporary dashboard with total/successful/failed job cards and a separate retry-attempt
card. Show a final-job-outcome chart and a retry-activity chart by job. Final status categories
(ok/fail/retry) sum to distinct jobs. Retry activity sums every row's retry attempts, including
jobs that later succeeded, and also names the number of affected jobs. These are different
measures and must not be mixed into one total. On the October 28 sample the overview shows
five jobs, four successful, one failed, and four retry attempts across two jobs (three plus
one). Build from the same rows as the table and JSON using server-rendered inline CSS/SVG,
numeric labels and zero-safe empty states. No client JavaScript or chart dependency.

### 2b. JSON

`GET /api/digest/:night` returns the same rows as JSON. Agents read this one; the page and the
JSON must never disagree (ADR 0001).

Done when: the JSON for 2026-10-28 has the same jobs, in the same order, as the page.

### 2c. Board link

The status board links each night on disk to its digest, with its ok / retry / fail counts beside
it.

Done when: both nights on disk link to a digest that renders.

### 2d. Route tests

Route tests for 2a and 2b: 200, 404 for a night with no file, the empty night, a night with a bad
line. Use a temp runs dir; `runs/` is read-only.

Also verify the user-approved overview agrees with the returned job rows, including a job
that retried and then succeeded and a job whose last status is retry. Historical retry attempts
must remain visible in the overview even when no job's final status is retry.

Done when: `pnpm test` is green with the new tests.

## 3. Preview for review

The reviewer reads the page from a copy, not from the lane. Run rig and save `/digest/2026-10-28` as
one HTML file, lane banner included (a command, not a browser's "save as"; the page is
self-contained, ADR 0001). Put it on your own public host, one where you can upload over it later (any bucket
or static host, ADR 0003), so it opens from a public HTTPS link. Send the reviewer the link and the
issues for this plan.

Done when: the preview link is sent to the reviewer.

## 4. Clean up

The preview carries this lane's marker on a public link (ADR 0003). Take the marker off: save the
page again with `LANE_MARKER` unset (the banner reads "no marker set") and upload it over the same
link. Move this plan to `docs/plans/done/` with its issue list.

Done when: the preview link no longer shows the lane marker.

## Issues

- [#1 Define the morning-digest contract](https://github.com/hello2kamal/mega-s01e04-before-i-looked/issues/1)
- [#2 Read and aggregate nightly run logs](https://github.com/hello2kamal/mega-s01e04-before-i-looked/issues/2)
- [#3 Render the digest page and overview graph](https://github.com/hello2kamal/mega-s01e04-before-i-looked/issues/3)
- [#4 Expose the matching digest JSON endpoint](https://github.com/hello2kamal/mega-s01e04-before-i-looked/issues/4)
- [#5 Link status-board nights to digest pages](https://github.com/hello2kamal/mega-s01e04-before-i-looked/issues/5)
- [#6 Test digest routes and overview consistency](https://github.com/hello2kamal/mega-s01e04-before-i-looked/issues/6)
- [#7 Publish and submit the morning-digest preview](https://github.com/hello2kamal/mega-s01e04-before-i-looked/issues/7)
- [#8 Remove the preview marker and archive the completed plan](https://github.com/hello2kamal/mega-s01e04-before-i-looked/issues/8)
