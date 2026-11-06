import type { DigestRow, DigestSummary, NightDigest } from '../digest/types.js';
import { retryActivityOf } from '../digest/activity.js';

function Metric(props: { label: string; value: number; caption: string; tone?: string }) {
  return (
    <section class={`metric-card${props.tone ? ` metric-${props.tone}` : ''}`} aria-label={props.label}>
      <h2>{props.label}</h2>
      <p class="metric-value">{props.value}</p>
      <p class="metric-caption">{props.caption}</p>
    </section>
  );
}

function OutcomeChart(props: { summary: DigestSummary }) {
  const { summary } = props;
  const total = summary.totalJobs;
  const successEnd = total === 0 ? 0 : (summary.success / total) * 100;
  const failureEnd = total === 0 ? 0 : ((summary.success + summary.failure) / total) * 100;
  const ring = total === 0
    ? 'conic-gradient(var(--chart-empty) 0% 100%)'
    : `conic-gradient(var(--success) 0% ${successEnd}%, var(--failure) ${successEnd}% ${failureEnd}%, var(--retry) ${failureEnd}% 100%)`;

  return (
    <section class="chart-card" aria-labelledby="outcomes-title">
      <div class="chart-heading">
        <div>
          <p class="eyebrow">Final status</p>
          <h2 id="outcomes-title">Latest job outcomes</h2>
        </div>
        <span class="chart-total">{total} jobs</span>
      </div>
      <div class="outcome-layout">
        <div
          class="outcome-ring"
          role="img"
          aria-label={`Latest status across ${summary.totalJobs} jobs: ${summary.success} success, ${summary.failure} failure, ${summary.retry} retry`}
          style={`--ring: ${ring}`}
        >
          <div class="ring-center"><strong>{total}</strong><span>jobs</span></div>
        </div>
        <ul class="outcome-legend">
          <li><span class="legend-dot success" /> <span>Successful</span><strong>{summary.success}</strong></li>
          <li><span class="legend-dot failure" /> <span>Failed</span><strong>{summary.failure}</strong></li>
          <li><span class="legend-dot retry" /> <span>Last status: retry</span><strong>{summary.retry}</strong></li>
        </ul>
      </div>
      <p class="chart-note">Each job appears once by its latest status. Earlier retry attempts are counted separately.</p>
    </section>
  );
}

function RetryChart(props: { rows: readonly DigestRow[] }) {
  const activity = retryActivityOf(props.rows);
  const maxAttempts = activity.jobs[0]?.attempts ?? 0;

  return (
    <section class="chart-card" aria-labelledby="retry-activity-title">
      <div class="chart-heading">
        <div>
          <p class="eyebrow">Earlier attempts</p>
          <h2 id="retry-activity-title">Retry activity</h2>
        </div>
        <span class="chart-total">{activity.retryAttempts} attempts</span>
      </div>
      {activity.jobs.length === 0 ? (
        <p class="chart-empty">No retry attempts recorded.</p>
      ) : (
        <div
          class="retry-bars"
          role="img"
          aria-label={`Retry activity: ${activity.retryAttempts} attempts across ${activity.jobsRetried} jobs`}
        >
          {activity.jobs.map(({ job, attempts }) => (
            <div class="retry-bar-row" key={job}>
              <span class="retry-job">{job}</span>
              <span class="retry-track" aria-hidden="true"><span class="retry-fill" style={`width: ${(attempts / maxAttempts) * 100}%`} /></span>
              <strong class="retry-count">{attempts}</strong>
            </div>
          ))}
        </div>
      )}
      <p class="chart-note">Attempts sum the retries column, including jobs that later succeeded.</p>
    </section>
  );
}

function DigestRowView(props: { row: DigestRow }) {
  const { row } = props;
  const highlighted = row.retries >= 3 || row.lastStatus === 'fail';
  return (
    <tr class={highlighted ? 'digest-attention' : undefined}>
      <td>{row.job}</td>
      <td>{row.owner ?? '—'}</td>
      <td>{row.runs}</td>
      <td class={row.retries >= 3 ? 'retry-attention' : undefined}>{row.retries}</td>
      <td><span class={`status-pill status-${row.lastStatus}`}>{row.lastStatus}</span></td>
      <td>{row.lastError ?? '—'}</td>
      <td>{row.firstAt}</td>
      <td>{row.lastAt}</td>
    </tr>
  );
}

export function DigestPage(props: { digest: NightDigest; summary: DigestSummary }) {
  const { digest, summary } = props;
  const retryActivity = retryActivityOf(digest.rows);

  return (
    <article class="digest">
      <div class="page-heading">
        <div>
          <p class="eyebrow">Morning report</p>
          <h1>Night digest</h1>
          <p class="page-subtitle">Run outcomes and retry activity for <time>{digest.night}</time></p>
        </div>
        <span class="night-badge">{digest.night}</span>
      </div>

      <section class="metrics-grid" aria-label="Job summary">
        <Metric label="Total jobs" value={summary.totalJobs} caption="Distinct jobs in this log" />
        <Metric label="Successful jobs" value={summary.success} caption="Last status: ok" tone="success" />
        <Metric label="Failed jobs" value={summary.failure} caption="Last status: fail" tone="failure" />
        <Metric label="Retry attempts" value={retryActivity.retryAttempts} caption={`Across ${retryActivity.jobsRetried} jobs with retries`} tone="retry" />
      </section>

      <div class="charts-grid">
        <OutcomeChart summary={summary} />
        <RetryChart rows={digest.rows} />
      </div>

      {digest.badLines > 0 && (
        <div class="log-warning" role="status">
          <strong>Malformed log lines skipped: {digest.badLines}.</strong>
          <span>These lines are not included as jobs in the totals.</span>
        </div>
      )}

      <section class="jobs-section" aria-labelledby="digest-jobs">
        <div class="section-heading">
          <div><p class="eyebrow">Run detail</p><h2 id="digest-jobs">Jobs</h2></div>
          <span class="chart-total">{digest.rows.length} rows</span>
        </div>
        {digest.rows.length === 0 ? (
          <p class="empty-state">{digest.badLines > 0 ? 'No valid jobs could be read.' : 'nothing ran'}</p>
        ) : (
          <div class="digest-table-wrap">
            <table class="digest-table">
              <thead>
                <tr>
                  <th scope="col">Job</th>
                  <th scope="col">Owner</th>
                  <th scope="col">Runs</th>
                  <th scope="col">Retries</th>
                  <th scope="col">Last status</th>
                  <th scope="col">Last reported error</th>
                  <th scope="col">First timestamp</th>
                  <th scope="col">Last timestamp</th>
                </tr>
              </thead>
              <tbody>{digest.rows.map((row) => <DigestRowView row={row} key={row.job} />)}</tbody>
            </table>
          </div>
        )}
      </section>
    </article>
  );
}
