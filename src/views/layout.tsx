import { raw } from 'hono/html';
import type { Child } from 'hono/jsx';
import type { Lane } from '../lane.js';

// One layout, one stylesheet, no client JS (ADR 0001). The banner is on every page: whoever
// looks at a copy of a rig page must be able to tell which lane it came from.
const css = `
  :root {
    color-scheme: light dark;
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-synthesis: none;
    text-rendering: optimizeLegibility;
    --fg: #172033;
    --bg: #f4f6fa;
    --surface: #ffffff;
    --surface-subtle: #f8f9fc;
    --mute: #667085;
    --line: #e3e7ef;
    --brand: #4f46e5;
    --brand-soft: #eef2ff;
    --success: #14804a;
    --success-soft: #eaf7ef;
    --failure: #c43d4d;
    --failure-soft: #fff0f1;
    --retry: #b66b0b;
    --retry-soft: #fff5e5;
    --chart-empty: #e4e8f0;
    --shadow: 0 1px 2px rgb(16 24 40 / 4%), 0 8px 24px rgb(16 24 40 / 4%);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --fg: #e7eaf2;
      --bg: #10131b;
      --surface: #181d28;
      --surface-subtle: #202634;
      --mute: #a2aabd;
      --line: #303747;
      --brand: #a5a4ff;
      --brand-soft: #29294a;
      --success: #5bd18a;
      --success-soft: #19382b;
      --failure: #ff858d;
      --failure-soft: #43252d;
      --retry: #f4b64d;
      --retry-soft: #40321d;
      --chart-empty: #303747;
      --shadow: 0 1px 2px rgb(0 0 0 / 18%), 0 10px 30px rgb(0 0 0 / 16%);
    }
  }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; color: var(--fg); background: var(--bg); font: 15px/1.55 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  a { color: var(--brand); text-underline-offset: .18em; }
  header { display: flex; align-items: center; gap: 1rem; min-height: 3.75rem; padding: .75rem max(1.25rem, calc((100vw - 78rem) / 2)); color: var(--fg); background: var(--surface); border-bottom: 1px solid var(--line); }
  header strong { font-size: 1rem; letter-spacing: -.03em; }
  header .marker { margin-left: auto; color: var(--mute); font-size: .82rem; }
  main { width: min(100% - 2.5rem, 78rem); margin: 0 auto; padding: 2.25rem 0 4rem; }
  h1, h2, p { margin-top: 0; }
  h1 { margin-bottom: .35rem; font-size: clamp(1.8rem, 3vw, 2.35rem); line-height: 1.2; letter-spacing: -.045em; }
  h2 { letter-spacing: -.02em; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: .65rem .8rem .65rem 0; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
  th { color: var(--mute); font-size: .8rem; font-weight: 600; }
  .warn { color: var(--failure); }
  .mute { color: var(--mute); }

  .digest { width: 100%; }
  .page-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; margin-bottom: 1.5rem; }
  .eyebrow { margin: 0 0 .35rem; color: var(--mute); font-size: .72rem; font-weight: 700; letter-spacing: .105em; text-transform: uppercase; }
  .page-subtitle { margin: 0; color: var(--mute); }
  .page-subtitle time { color: var(--fg); font-weight: 650; }
  .night-badge, .chart-total { display: inline-flex; align-items: center; border: 1px solid var(--line); border-radius: 999px; background: var(--surface-subtle); color: var(--mute); font-size: .78rem; font-weight: 650; padding: .35rem .7rem; white-space: nowrap; }
  .metrics-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1rem; margin-bottom: 1rem; }
  .metric-card, .chart-card, .jobs-section { min-width: 0; border: 1px solid var(--line); border-radius: 1rem; background: var(--surface); box-shadow: var(--shadow); }
  .metric-card { padding: 1.1rem 1.2rem; }
  .metric-card h2 { margin: 0 0 .65rem; color: var(--mute); font-size: .83rem; font-weight: 650; letter-spacing: 0; }
  .metric-value { margin: 0; font-size: 2rem; font-weight: 720; letter-spacing: -.055em; line-height: 1.1; font-variant-numeric: tabular-nums; }
  .metric-caption { margin: .45rem 0 0; color: var(--mute); font-size: .78rem; }
  .metric-success .metric-value { color: var(--success); }
  .metric-failure .metric-value { color: var(--failure); }
  .metric-retry .metric-value { color: var(--retry); }
  .charts-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
  .chart-card { padding: 1.25rem; }
  .chart-heading, .section-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: .75rem; }
  .chart-heading h2, .section-heading h2 { margin: 0; font-size: 1rem; }
  .chart-heading .eyebrow, .section-heading .eyebrow { margin-bottom: .25rem; }
  .outcome-layout { display: flex; align-items: center; justify-content: center; gap: clamp(1.2rem, 5vw, 3.5rem); min-height: 11.5rem; padding: .5rem 0; }
  .outcome-ring { display: grid; flex: 0 0 auto; width: 9.25rem; aspect-ratio: 1; place-items: center; border-radius: 50%; background: var(--ring); position: relative; }
  .outcome-ring::before { position: absolute; inset: 18%; border-radius: 50%; background: var(--surface); content: ""; }
  .ring-center { z-index: 1; display: flex; flex-direction: column; align-items: center; line-height: 1.2; }
  .ring-center strong { font-size: 1.65rem; letter-spacing: -.04em; font-variant-numeric: tabular-nums; }
  .ring-center span { color: var(--mute); font-size: .75rem; }
  .outcome-legend { display: grid; gap: .75rem; width: min(100%, 13rem); margin: 0; padding: 0; list-style: none; }
  .outcome-legend li { display: grid; grid-template-columns: .6rem minmax(0, 1fr) auto; align-items: center; gap: .55rem; font-size: .82rem; }
  .outcome-legend strong { font-variant-numeric: tabular-nums; }
  .legend-dot { width: .58rem; height: .58rem; border-radius: 50%; }
  .legend-dot.success { background: var(--success); }
  .legend-dot.failure { background: var(--failure); }
  .legend-dot.retry { background: var(--retry); }
  .chart-note { margin: .65rem 0 0; color: var(--mute); font-size: .75rem; }
  .retry-bars { display: grid; align-content: center; gap: 1rem; min-height: 11.5rem; padding: 1rem 0 .4rem; }
  .retry-bar-row { display: grid; grid-template-columns: minmax(5rem, 8.5rem) minmax(3rem, 1fr) 1.5rem; align-items: center; gap: .75rem; }
  .retry-job { overflow-wrap: anywhere; font-size: .8rem; }
  .retry-track { display: block; height: .65rem; overflow: hidden; border-radius: 999px; background: var(--surface-subtle); }
  .retry-fill { display: block; height: 100%; border-radius: inherit; background: var(--retry); }
  .retry-count { text-align: right; font-size: .82rem; font-variant-numeric: tabular-nums; }
  .chart-empty, .empty-state { display: grid; min-height: 11.5rem; margin: 0; place-items: center; color: var(--mute); }
  .log-warning { display: flex; flex-wrap: wrap; gap: .2rem .65rem; margin: 0 0 1.5rem; padding: .85rem 1rem; border: 1px solid color-mix(in srgb, var(--retry) 35%, var(--line)); border-radius: .75rem; background: var(--retry-soft); color: var(--fg); font-size: .85rem; }
  .log-warning strong { color: var(--retry); }
  .jobs-section { padding: 1.25rem 1.25rem .25rem; }
  .section-heading { align-items: center; margin-bottom: .75rem; }
  .digest-table-wrap { overflow-x: auto; margin: 0 -1.25rem; padding: 0 1.25rem; }
  .digest-table { min-width: 68rem; }
  .digest-table th { white-space: nowrap; }
  .digest-table td { white-space: nowrap; }
  .digest-table td:nth-child(6), .digest-table td:nth-child(7), .digest-table td:nth-child(8) { white-space: normal; min-width: 10rem; overflow-wrap: anywhere; }
  .digest-table td:first-child { font-weight: 620; }
  .digest-attention { background: color-mix(in srgb, var(--failure) 5%, var(--surface)); }
  .retry-attention { color: var(--retry); font-weight: 700; }
  .status-pill { display: inline-block; padding: .12rem .52rem; border-radius: 999px; font-size: .76rem; font-weight: 700; text-transform: capitalize; }
  .status-ok { background: var(--success-soft); color: var(--success); }
  .status-fail { background: var(--failure-soft); color: var(--failure); }
  .status-retry { background: var(--retry-soft); color: var(--retry); }
  @media (max-width: 58rem) {
    main { width: min(100% - 2rem, 78rem); padding-top: 1.5rem; }
    .metrics-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .charts-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 38rem) {
    header { padding-right: 1rem; padding-left: 1rem; }
    main { width: calc(100% - 1.25rem); padding-top: 1.2rem; }
    .page-heading { align-items: flex-start; }
    .night-badge { margin-top: .15rem; }
    .metrics-grid { gap: .65rem; }
    .metric-card { padding: .9rem; border-radius: .8rem; }
    .metric-card h2 { min-height: 2.4em; font-size: .77rem; }
    .metric-value { font-size: 1.65rem; }
    .metric-caption { font-size: .72rem; }
    .chart-card { padding: 1rem; }
    .outcome-layout { justify-content: space-around; gap: .75rem; }
    .outcome-ring { width: 7.5rem; }
    .outcome-legend { width: auto; }
    .retry-bar-row { grid-template-columns: minmax(4rem, 6.5rem) minmax(2rem, 1fr) 1.25rem; gap: .5rem; }
    .jobs-section { padding-right: .8rem; padding-left: .8rem; }
    .digest-table-wrap { margin-right: -.8rem; margin-left: -.8rem; padding-right: .8rem; padding-left: .8rem; }
  }
`;

export function Layout(props: { title: string; lane: Lane; children: Child }) {
  return (
    <>
      {raw('<!doctype html>')}
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>rig · {props.title}</title>
          <style>{raw(css)}</style>
        </head>
        <body>
          <header>
            <strong>rig</strong>
            <span>{props.lane.id}</span>
            <span class="marker">{props.lane.marker ?? 'no marker set'}</span>
          </header>
          <main>{props.children}</main>
        </body>
      </html>
    </>
  );
}
