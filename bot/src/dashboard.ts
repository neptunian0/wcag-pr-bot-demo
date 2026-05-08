/**
 * Static dashboard generator. Reads `bot/data/aggregate.json` and emits
 * `bot/dashboard.html` — a single self-contained file with no external
 * dependencies, intended to be opened directly from disk during the demo.
 *
 * The HTML itself is WCAG-compliant: lang attribute, heading hierarchy,
 * sufficient contrast, accessible chart with text alternative.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

interface AggregateData {
  weekStart: string;
  weekEnd: string;
  introduced: number;
  resolved: number;
  openWeakDismissals: Array<{
    pr: number;
    criterion: string;
    title: string;
    rationale: string;
  }>;
  topDismissed: Array<{
    criterion: string;
    label: string;
    count: number;
  }>;
  trendData: Array<{
    week: string;
    introduced: number;
    resolved: number;
  }>;
}

const dataPath = resolve(import.meta.dirname, "..", "data", "aggregate.json");
const outPath = resolve(import.meta.dirname, "..", "dashboard.html");

const data: AggregateData = JSON.parse(readFileSync(dataPath, "utf8"));

function formatWeek(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}

function buildTrendChart(trend: AggregateData["trendData"]): string {
  const maxValue = Math.max(...trend.flatMap((w) => [w.introduced, w.resolved]), 1);
  const barWidth = 32;
  const barGap = 6;
  const groupGap = 28;
  const groupWidth = barWidth * 2 + barGap;
  const xStep = groupWidth + groupGap;
  const chartHeight = 220;
  const chartTop = 20;
  const chartBottom = chartTop + chartHeight;
  const labelArea = 36;
  const yAxis = 44;
  const totalWidth = yAxis + trend.length * xStep + 16;
  const totalHeight = chartBottom + labelArea;
  const scale = (chartHeight - 12) / maxValue;

  const ticks = [0, Math.ceil(maxValue / 2), maxValue];
  const tickLines = ticks
    .map((t) => {
      const y = chartBottom - t * scale;
      return `
        <line x1="${yAxis}" x2="${totalWidth - 12}" y1="${y}" y2="${y}" stroke="#e2e8f0" stroke-width="1" />
        <text x="${yAxis - 6}" y="${y + 4}" text-anchor="end" fill="#64748b" font-size="11">${t}</text>
      `;
    })
    .join("");

  const bars = trend
    .map((w, i) => {
      const x = yAxis + i * xStep;
      const introH = w.introduced * scale;
      const resH = w.resolved * scale;
      const introY = chartBottom - introH;
      const resY = chartBottom - resH;
      return `
        <g>
          <rect x="${x}" y="${introY}" width="${barWidth}" height="${introH}" fill="#dc2626" rx="2" />
          <text x="${x + barWidth / 2}" y="${introY - 5}" text-anchor="middle" fill="#0f172a" font-size="11" font-weight="600">${w.introduced}</text>
          <rect x="${x + barWidth + barGap}" y="${resY}" width="${barWidth}" height="${resH}" fill="#16a34a" rx="2" />
          <text x="${x + barWidth + barGap + barWidth / 2}" y="${resY - 5}" text-anchor="middle" fill="#0f172a" font-size="11" font-weight="600">${w.resolved}</text>
          <text x="${x + groupWidth / 2}" y="${chartBottom + 18}" text-anchor="middle" fill="#475569" font-size="11">${escapeHtml(formatWeek(w.week))}</text>
        </g>
      `;
    })
    .join("");

  return `
    <svg viewBox="0 0 ${totalWidth} ${totalHeight}" role="img" aria-labelledby="chartTitle chartDesc" preserveAspectRatio="xMidYMid meet">
      <title id="chartTitle">Issues introduced and resolved per week</title>
      <desc id="chartDesc">Bar chart over ${trend.length} weeks. Issues introduced are shown in red, resolved in green.</desc>
      ${tickLines}
      ${bars}
    </svg>
  `;
}

const introduced = data.introduced;
const resolved = data.resolved;
const net = resolved - introduced;
const netClass = net > 0 ? "positive" : net < 0 ? "negative" : "neutral";
const netDisplay = `${net > 0 ? "+" : ""}${net}`;
const netLabel = net > 0 ? "Net positive" : net < 0 ? "Net negative" : "No net change";

const periodLabel = `${formatWeek(data.weekStart)} – ${formatWeek(data.weekEnd)}`;

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>WCAG Review Dashboard — ${escapeHtml(periodLabel)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      background: #f8fafc;
      color: #0f172a;
      line-height: 1.5;
    }
    .page {
      max-width: 1080px;
      margin: 0 auto;
      padding: 2rem 1.5rem 4rem;
    }
    header.page-header {
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #e2e8f0;
    }
    header.page-header h1 {
      margin: 0;
      font-size: 1.75rem;
      letter-spacing: -0.01em;
    }
    header.page-header .subtitle {
      margin: 0.25rem 0 0;
      color: #475569;
      font-size: 0.95rem;
    }
    section {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1.25rem 1.5rem;
      margin-bottom: 1.25rem;
    }
    section h2 {
      margin: 0 0 1rem;
      font-size: 1.1rem;
      letter-spacing: -0.005em;
    }
    .kpis {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 0.75rem;
    }
    .kpi {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 0.85rem 1rem;
    }
    .kpi-label {
      color: #475569;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 0.25rem;
    }
    .kpi-value {
      font-size: 1.85rem;
      font-weight: 600;
      letter-spacing: -0.02em;
    }
    .kpi-value-label {
      font-size: 0.8rem;
      color: #475569;
      font-weight: 400;
    }
    .kpi-positive .kpi-value { color: #15803d; }
    .kpi-negative .kpi-value { color: #b91c1c; }
    .legend {
      display: flex;
      gap: 1.5rem;
      margin-bottom: 0.75rem;
      font-size: 0.85rem;
      color: #475569;
    }
    .legend-swatch {
      display: inline-block;
      width: 0.85rem;
      height: 0.85rem;
      border-radius: 2px;
      vertical-align: -2px;
      margin-right: 0.4rem;
    }
    .chart-container {
      width: 100%;
      overflow-x: auto;
    }
    .chart-container svg {
      display: block;
      max-width: 100%;
      height: auto;
    }
    details {
      margin-top: 1rem;
      font-size: 0.9rem;
    }
    details summary {
      cursor: pointer;
      color: #1d4ed8;
    }
    details summary:focus-visible {
      outline: 2px solid #1d4ed8;
      outline-offset: 2px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 0.75rem;
      font-size: 0.9rem;
    }
    th, td {
      padding: 0.5rem 0.75rem;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }
    th { background: #f1f5f9; font-weight: 600; }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.25rem;
    }
    @media (max-width: 720px) {
      .grid-2 { grid-template-columns: 1fr; }
    }
    .grid-2 section { margin-bottom: 0; }
    .hint {
      color: #475569;
      font-size: 0.85rem;
      margin: -0.25rem 0 1rem;
    }
    .dismissed-list, .weak-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .dismissed-list li {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 0.75rem;
      align-items: center;
      padding: 0.5rem 0;
      border-bottom: 1px solid #f1f5f9;
      font-size: 0.92rem;
    }
    .dismissed-list li:last-child { border-bottom: none; }
    .sc-tag {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      background: #eff6ff;
      color: #1e3a8a;
      padding: 0.15rem 0.5rem;
      border-radius: 3px;
      font-size: 0.82rem;
    }
    .sc-count {
      color: #475569;
      font-size: 0.85rem;
    }
    .weak-list li {
      padding: 0.85rem 0;
      border-bottom: 1px solid #f1f5f9;
    }
    .weak-list li:last-child { border-bottom: none; }
    .weak-header {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.4rem;
      align-items: center;
    }
    .pr-tag {
      background: #f1f5f9;
      color: #0f172a;
      font-weight: 600;
      padding: 0.15rem 0.5rem;
      border-radius: 3px;
      font-size: 0.82rem;
    }
    .weak-title {
      margin: 0 0 0.4rem;
      font-weight: 500;
    }
    .weak-rationale {
      margin: 0;
      padding: 0.6rem 0.85rem;
      border-left: 3px solid #f59e0b;
      background: #fffbeb;
      color: #78350f;
      font-style: italic;
      font-size: 0.9rem;
      border-radius: 0 4px 4px 0;
    }
    .empty {
      color: #475569;
      font-style: italic;
    }
    footer {
      margin-top: 2rem;
      padding-top: 1rem;
      border-top: 1px solid #e2e8f0;
      color: #475569;
      font-size: 0.85rem;
    }
    a { color: #1d4ed8; }
    a:focus-visible { outline: 2px solid #1d4ed8; outline-offset: 2px; }
  </style>
</head>
<body>
  <div class="page">
    <header class="page-header">
      <h1>WCAG accessibility review</h1>
      <p class="subtitle">Week of ${escapeHtml(periodLabel)}</p>
    </header>

    <section aria-labelledby="kpiHeading">
      <h2 id="kpiHeading">This week</h2>
      <div class="kpis">
        <div class="kpi">
          <div class="kpi-label">Introduced</div>
          <div class="kpi-value">${introduced}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Resolved</div>
          <div class="kpi-value">${resolved}</div>
        </div>
        <div class="kpi kpi-${netClass}">
          <div class="kpi-label">Net</div>
          <div class="kpi-value">${escapeHtml(netDisplay)}</div>
          <div class="kpi-value-label">${netLabel}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Open weak dismissals</div>
          <div class="kpi-value">${data.openWeakDismissals.length}</div>
        </div>
      </div>
    </section>

    <section aria-labelledby="trendHeading">
      <h2 id="trendHeading">${data.trendData.length}-week trend</h2>
      <div class="legend" aria-hidden="true">
        <span><span class="legend-swatch" style="background:#dc2626"></span>Introduced</span>
        <span><span class="legend-swatch" style="background:#16a34a"></span>Resolved</span>
      </div>
      <div class="chart-container">${buildTrendChart(data.trendData)}</div>
      <details>
        <summary>Show data as a table</summary>
        <table>
          <caption class="visually-hidden">Issues introduced and resolved per week</caption>
          <thead>
            <tr>
              <th scope="col">Week starting</th>
              <th scope="col">Introduced</th>
              <th scope="col">Resolved</th>
              <th scope="col">Net</th>
            </tr>
          </thead>
          <tbody>
            ${data.trendData
              .map((w) => {
                const n = w.resolved - w.introduced;
                return `<tr>
              <td>${escapeHtml(formatWeek(w.week))}</td>
              <td>${w.introduced}</td>
              <td>${w.resolved}</td>
              <td>${n > 0 ? "+" : ""}${n}</td>
            </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </details>
    </section>

    <div class="grid-2">
      <section aria-labelledby="dismissedHeading">
        <h2 id="dismissedHeading">Top dismissed criteria</h2>
        <p class="hint">Recurring patterns may indicate prompt tuning is warranted, or a real product gap.</p>
        <ul class="dismissed-list">
          ${data.topDismissed
            .map(
              (d) => `
            <li>
              <span class="sc-tag">${escapeHtml(d.criterion)}</span>
              <span class="sc-label">${escapeHtml(d.label)}</span>
              <span class="sc-count">${d.count} dismissals</span>
            </li>
          `
            )
            .join("")}
        </ul>
      </section>

      <section aria-labelledby="weakHeading">
        <h2 id="weakHeading">Open weak dismissals</h2>
        <p class="hint">Findings dismissed without a concrete plan or follow-up ticket.</p>
        ${
          data.openWeakDismissals.length === 0
            ? `<p class="empty">No open weak dismissals — nice.</p>`
            : `<ul class="weak-list">
          ${data.openWeakDismissals
            .map(
              (w) => `
            <li>
              <div class="weak-header">
                <span class="pr-tag">PR #${w.pr}</span>
                <span class="sc-tag">${escapeHtml(w.criterion)}</span>
              </div>
              <p class="weak-title">${escapeHtml(w.title)}</p>
              <blockquote class="weak-rationale">${escapeHtml(w.rationale)}</blockquote>
            </li>
          `
            )
            .join("")}
        </ul>`
        }
      </section>
    </div>

    <footer>
      <p>Generated ${escapeHtml(new Date().toISOString())} from <code>bot/data/aggregate.json</code>.</p>
    </footer>
  </div>
</body>
</html>
`;

writeFileSync(outPath, html, "utf8");
console.log(`Wrote ${outPath} (${html.length} bytes)`);
