import type { DigestRow, DigestSummary, NightDigest } from '../digest/types.js';

function CountBar(props: { label: string; count: number; total: number; kind: string }) {
  const percentage = props.total === 0 ? 0 : (props.count / props.total) * 100;
  return (
    <div class="digest-bar-row">
      <span class="digest-bar-label">{props.label}</span>
      <span class="digest-bar-track" aria-hidden="true">
        <span class={`digest-bar-fill ${props.kind}`} style={`width: ${percentage}%`} />
      </span>
      <strong class="digest-bar-count">{props.count}</strong>
    </div>
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
      <td>{row.retries}</td>
      <td class={row.lastStatus === 'fail' ? 'warn' : undefined}>{row.lastStatus}</td>
      <td>{row.lastError ?? '—'}</td>
      <td>{row.firstAt}</td>
      <td>{row.lastAt}</td>
    </tr>
  );
}

export function DigestPage(props: { digest: NightDigest; summary?: DigestSummary }) {
  const { digest } = props;
  const summary = props.summary ?? {
    totalJobs: digest.rows.length,
    success: digest.rows.filter((row) => row.lastStatus === 'ok').length,
    failure: digest.rows.filter((row) => row.lastStatus === 'fail').length,
    retry: digest.rows.filter((row) => row.lastStatus === 'retry').length,
  };

  return (
    <article class="digest">
      <h1>Night digest: {digest.night}</h1>
      <section aria-labelledby="digest-overview">
        <h2 id="digest-overview">Overview</h2>
        <p><strong>{summary.totalJobs}</strong> distinct jobs</p>
        <div class="digest-chart" role="img" aria-label={`Latest status across ${summary.totalJobs} jobs: ${summary.success} success, ${summary.failure} failure, ${summary.retry} retry`}>
          <CountBar label="Success" count={summary.success} total={summary.totalJobs} kind="success" />
          <CountBar label="Failure" count={summary.failure} total={summary.totalJobs} kind="failure" />
          <CountBar label="Retry" count={summary.retry} total={summary.totalJobs} kind="retry" />
        </div>
        <p class="mute">Counts use each job’s latest status. A job that retried and later succeeded is counted as success; its earlier retries remain in the table.</p>
      </section>

      {digest.badLines > 0 && (
        <p class="warn" role="status">Malformed log lines skipped: {digest.badLines}. These lines are not included as jobs in the totals.</p>
      )}

      <section aria-labelledby="digest-jobs">
        <h2 id="digest-jobs">Jobs</h2>
        {digest.rows.length === 0 ? (
          <p>nothing ran</p>
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
