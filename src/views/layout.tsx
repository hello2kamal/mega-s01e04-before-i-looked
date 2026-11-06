import { raw } from 'hono/html';
import type { Child } from 'hono/jsx';
import type { Lane } from '../lane.js';

// One layout, one stylesheet, no client JS (ADR 0001). The banner is on every page: whoever
// looks at a copy of a rig page must be able to tell which lane it came from.
const css = `
  :root { color-scheme: light dark; --fg: #1d1d1b; --bg: #f6f4ee; --mute: #6b6a64; --line: #d9d5c9; --warn: #a14a12; }
  @media (prefers-color-scheme: dark) { :root { --fg: #e8e6df; --bg: #161614; --mute: #9a988f; --line: #33322e; --warn: #e08a4f; } }
  body { margin: 0; font: 15px/1.5 ui-monospace, "SF Mono", Menlo, Consolas, monospace; color: var(--fg); background: var(--bg); }
  header { display: flex; gap: 1.5rem; padding: .75rem 1.25rem; border-bottom: 1px solid var(--line); }
  header .marker { margin-left: auto; color: var(--mute); }
  main { padding: 1.25rem; max-width: 60rem; }
  table { border-collapse: collapse; width: 100%; }
  th, td { text-align: left; padding: .35rem .75rem .35rem 0; border-bottom: 1px solid var(--line); }
  th { color: var(--mute); font-weight: normal; }
  .warn { color: var(--warn); }
  .mute { color: var(--mute); }
  .digest { max-width: 90rem; }
  .digest h1 { margin-top: 0; }
  .digest h2 { margin-bottom: .35rem; font-size: 1.05rem; }
  .digest section { margin: 1.5rem 0; }
  .digest-chart { max-width: 32rem; }
  .digest-bar-row { display: grid; grid-template-columns: 6rem minmax(5rem, 1fr) 2rem; align-items: center; gap: .6rem; margin: .3rem 0; }
  .digest-bar-track { height: .85rem; overflow: hidden; border: 1px solid var(--line); }
  .digest-bar-fill { display: block; height: 100%; }
  .digest-bar-fill.success { background: #39804c; }
  .digest-bar-fill.failure { background: #b44c3b; }
  .digest-bar-fill.retry { background: #b47a29; }
  .digest-bar-count { text-align: right; }
  .digest-table-wrap { overflow-x: auto; }
  .digest-table { min-width: 72rem; }
  .digest-table th, .digest-table td { white-space: nowrap; }
  .digest-table td:nth-child(6) { white-space: normal; min-width: 14rem; overflow-wrap: anywhere; }
  .digest-attention { background: color-mix(in srgb, var(--warn) 10%, transparent); }
  @media (max-width: 40rem) { main { padding: .8rem; } header { padding: .75rem .8rem; } }
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
