/**
 * StockAI Pro — k6 baseline load test (PRZED zmianami).
 *
 * Uruchomienie (z katalogu apps/api):
 *   k6 run tests/load-test.js
 *
 * Docker (Windows / bez lokalnego k6):
 *   docker run --rm -v "%cd%:/work" -w /work -e BASE_URL=http://host.docker.internal:3000 grafana/k6 run tests/load-test.js
 *
 * Zmienne środowiskowe:
 *   BASE_URL      — host testowany (np. http://host.docker.internal:3000 lub URL nginx)
 *   HOME_PATH     — domyślnie / (dla samego API StockAI często brak GET / — ustaw np. /health)
 *   SEARCH_PATH   — domyślnie /api/search?q=TESTER (w repo jest /api/companies/search — ustaw SEARCH_PATH)
 *   QUOTE_SYMBOL  — domyślnie AAPL
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";

// Custom metrics (wymaganie: homepage_response + ogólne miary błędów)
const homepageResponse = new Trend("homepage_response");
const searchResponse = new Trend("search_response");
const quotesResponse = new Trend("quotes_response");
const scenarioErrors = new Rate("scenario_errors");
const scenarioRequests = new Counter("scenario_requests");

const BASE_URL = (__ENV.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const HOME_PATH = __ENV.HOME_PATH || "/";
const SEARCH_PATH = __ENV.SEARCH_PATH || "/api/search?q=TESTER";
const QUOTE_SYMBOL = (__ENV.QUOTE_SYMBOL || "AAPL").toUpperCase();

export const options = {
  scenarios: {
    // Scenario A: 100 VU, 2 min
    homepage: {
      executor: "constant-vus",
      vus: 100,
      duration: "2m",
      exec: "scenarioHomepage",
      startTime: "0s",
      tags: { scenario: "A_homepage" },
    },
    // Scenario B: 50 VU, 2 min (po A)
    search: {
      executor: "constant-vus",
      vus: 50,
      duration: "2m",
      exec: "scenarioSearch",
      startTime: "2m",
      tags: { scenario: "B_search" },
    },
    // Scenario C: 20 VU, 2 min (po B)
    quotes: {
      executor: "constant-vus",
      vus: 20,
      duration: "2m",
      exec: "scenarioQuotes",
      startTime: "4m",
      tags: { scenario: "C_quotes" },
    },
  },
  // Brak twardych progów: przy wyłączonym serwerze i tak chcemy HTML baseline (error rate w raporcie).
  summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
};

function joinBase(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_URL}${p}`;
}

export function scenarioHomepage() {
  const url = joinBase(HOME_PATH || "/");
  const res = http.get(url, { tags: { scenario: "A_homepage" } });
  scenarioRequests.add(1);
  homepageResponse.add(res.timings.duration);
  const ok = check(res, {
    "A: status < 500": (r) => r.status < 500,
  });
  scenarioErrors.add(!ok);
  sleep(0.1);
}

export function scenarioSearch() {
  const url = joinBase(SEARCH_PATH);
  const res = http.get(url, { tags: { scenario: "B_search" } });
  scenarioRequests.add(1);
  searchResponse.add(res.timings.duration);
  const ok = check(res, {
    "B: status < 500": (r) => r.status < 500,
  });
  scenarioErrors.add(!ok);
  sleep(0.15);
}

export function scenarioQuotes() {
  const url = joinBase(`/api/quotes/${QUOTE_SYMBOL}`);
  const res = http.get(url, { tags: { scenario: "C_quotes" } });
  scenarioRequests.add(1);
  quotesResponse.add(res.timings.duration);
  const ok = check(res, {
    "C: status < 500": (r) => r.status < 500,
  });
  scenarioErrors.add(!ok);
  sleep(0.2);
}

function metricVals(m) {
  if (!m || !m.values) return null;
  return m.values;
}

function fmtNum(n) {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  return typeof n === "number" ? n.toFixed(2) : String(n);
}

function buildBottleneckHints(data) {
  const hints = [];
  const dur = metricVals(data.metrics?.http_req_duration);
  const fail = metricVals(data.metrics?.http_req_failed);
  const p95 = dur?.["p(95)"];
  const p99 = dur?.["p(99)"];
  const errRate = fail?.rate;

  if (errRate !== undefined && errRate > 0.05) {
    hints.push(
      "Wysoki error rate: sprawdź czy BASE_URL i ścieżki są poprawne (GET / i /api/search często nie istnieją na samym API — użyj nginx lub HOME_PATH=/health i SEARCH_PATH=/api/companies/search?q=TESTER).",
    );
  }
  if (p95 !== undefined && p95 > 2000) {
    hints.push("p95 http_req_duration > 2s: możliwe wąskie gardła — baza (Timescale), brak indeksów, cold cache, limity zewnętrznych API przy scrapingu.");
  }
  if (p99 !== undefined && p99 > 5000) {
    hints.push("p99 bardzo wysoki: rozważ connection pooling, limity równoległości DB, skalowanie horyzontalne API lub CDN dla statycznego frontu.");
  }
  if (hints.length === 0) {
    hints.push("Brak automatycznych alertów progowych — przejrzyj rozkład czasów odpowiedzi i error rate w tabelach poniżej.");
  }
  return hints;
}

function trendTable(title, metric) {
  const v = metricVals(metric);
  if (!v) return `<h3>${title}</h3><p>Brak danych.</p>`;
  const rows = ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"]
    .filter((k) => v[k] !== undefined)
    .map((k) => `<tr><td>${k}</td><td>${fmtNum(v[k])} ms</td></tr>`)
    .join("");
  return `
    <h3>${title}</h3>
    <table>
      <thead><tr><th>Stat</th><th>Wartość</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

export function handleSummary(data) {
  const httpDur = metricVals(data.metrics?.http_req_duration);
  const httpFail = metricVals(data.metrics?.http_req_failed);
  const httpReqs = metricVals(data.metrics?.http_reqs);
  const hints = buildBottleneckHints(data);

  const html = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8"/>
  <title>StockAI Pro — k6 load test report</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; color: #1e293b; }
    h1 { border-bottom: 2px solid #0ea5e9; padding-bottom: 0.5rem; }
    h2 { margin-top: 2rem; }
    table { border-collapse: collapse; width: 100%; max-width: 720px; }
    th, td { border: 1px solid #cbd5e1; padding: 0.5rem 0.75rem; text-align: left; }
    th { background: #f1f5f9; }
    .hint { background: #fff7ed; border-left: 4px solid #f97316; padding: 0.75rem 1rem; margin: 0.5rem 0; }
    code { background: #f1f5f9; padding: 0.1rem 0.35rem; }
  </style>
</head>
<body>
  <h1>StockAI Pro — raport obciążeniowy k6 (baseline)</h1>
  <p>Wygenerowano: <strong>${new Date().toISOString()}</strong></p>
  <p>
    <code>BASE_URL</code>=${BASE_URL} &nbsp;
    <code>HOME_PATH</code>=${HOME_PATH} &nbsp;
    <code>SEARCH_PATH</code>=${SEARCH_PATH} &nbsp;
    <code>QUOTE_SYMBOL</code>=${QUOTE_SYMBOL}
  </p>

  <h2>1. Summary metrics</h2>
  <table>
    <thead><tr><th>Metryka</th><th>Wartość</th></tr></thead>
    <tbody>
      <tr><td>http_reqs (count)</td><td>${httpReqs?.count ?? "—"}</td></tr>
      <tr><td>http_reqs (rate / RPS)</td><td>${fmtNum(httpReqs?.rate)}</td></tr>
      <tr><td>http_req_failed (rate = error rate)</td><td>${fmtNum(httpFail?.rate)}</td></tr>
      <tr><td>http_req_duration p50 (med)</td><td>${fmtNum(httpDur?.med)} ms</td></tr>
      <tr><td>http_req_duration p95</td><td>${fmtNum(httpDur?.["p(95)"])} ms</td></tr>
      <tr><td>http_req_duration p99</td><td>${fmtNum(httpDur?.["p(99)"])} ms</td></tr>
    </tbody>
  </table>

  <h2>2. Response time distribution (global http_req_duration)</h2>
  ${trendTable("http_req_duration", data.metrics?.http_req_duration)}

  <h2>3. Custom metric: homepage_response (Scenario A)</h2>
  ${trendTable("homepage_response", data.metrics?.homepage_response)}

  <h2>4. Scenario B — search_response</h2>
  ${trendTable("search_response", data.metrics?.search_response)}

  <h2>5. Scenario C — quotes_response</h2>
  ${trendTable("quotes_response", data.metrics?.quotes_response)}

  <h2>6. Error analysis</h2>
  <p>Globalny wskaźnik błędów HTTP (k6): <strong>${fmtNum(httpFail?.rate)}</strong> (0 = 0%, 1 = 100%).</p>
  <p>Szczegóły żądań z kodami 4xx/5xx sprawdź w logach serwera oraz w konsoli k6 (uruchom z <code>--verbose</code> lub eksportem JSON).</p>

  <h2>7. Bottleneck suggestions</h2>
  ${hints.map((h) => `<div class="hint">${h}</div>`).join("")}

  <h2>8. Scenariusze</h2>
  <ul>
    <li><strong>A</strong>: 100 VU × 2 min — <code>GET ${HOME_PATH}</code></li>
    <li><strong>B</strong>: 50 VU × 2 min — <code>GET ${SEARCH_PATH}</code></li>
    <li><strong>C</strong>: 20 VU × 2 min — <code>GET /api/quotes/${QUOTE_SYMBOL}</code></li>
  </ul>
  <p>Czas całkowity testu: ok. <strong>6 minut</strong> (3 × 2 min sekwencyjnie).</p>
</body>
</html>`;

  return {
    "results/load-test-report.html": html,
    stdout: textSummary(data),
  };
}

function textSummary(data) {
  const httpDur = metricVals(data.metrics?.http_req_duration);
  const httpFail = metricVals(data.metrics?.http_req_failed);
  const httpReqs = metricVals(data.metrics?.http_reqs);
  return `
k6 summary
----------
http_reqs: ${httpReqs?.count ?? "—"} (rate: ${fmtNum(httpReqs?.rate)} req/s)
http_req_failed rate: ${fmtNum(httpFail?.rate)}
http_req_duration p50: ${fmtNum(httpDur?.med)} ms | p95: ${fmtNum(httpDur?.["p(95)"])} ms | p99: ${fmtNum(httpDur?.["p(99)"])} ms
HTML report: results/load-test-report.html
`;
}
