/**
 * StockAI Pro — k6 FINAL load test: baseline (A–C) + Dividend module (D–F).
 *
 * Timeline (~10 min wall clock):
 *   0–2m: A (100 VU) health
 *   2–4m: B (50 VU) search
 *   4–6m: C (20 VU) quotes
 *   6–8m: D (30 VU) dividends + E (25 VU) screener — równolegle
 *   8–10m: F (10 VU) tax calculator
 *
 *   docker run --rm -v "%cd%:/work" -w /work -e BASE_URL=http://host.docker.internal:3000 ...
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";

const homepageResponse = new Trend("homepage_response");
const searchResponse = new Trend("search_response");
const quotesResponse = new Trend("quotes_response");
const dividendResponse = new Trend("dividend_response");
const screenerResponse = new Trend("screener_response");
const taxCalcResponse = new Trend("tax_calc_response");
const scenarioErrors = new Rate("scenario_errors");
const scenarioRequests = new Counter("scenario_requests");

const BASE_URL = (__ENV.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const HOME_PATH = __ENV.HOME_PATH || "/";
const SEARCH_PATH = __ENV.SEARCH_PATH || "/api/search?q=TESTER";
const QUOTE_SYMBOL = (__ENV.QUOTE_SYMBOL || "AAPL").toUpperCase();
const DIVIDEND_SYMBOL = (__ENV.DIVIDEND_SYMBOL || "AAPL").toUpperCase();

export const options = {
  scenarios: {
    homepage: {
      executor: "constant-vus",
      vus: 100,
      duration: "2m",
      exec: "scenarioHomepage",
      startTime: "0s",
      tags: { scenario: "A_homepage" },
    },
    search: {
      executor: "constant-vus",
      vus: 50,
      duration: "2m",
      exec: "scenarioSearch",
      startTime: "2m",
      tags: { scenario: "B_search" },
    },
    quotes: {
      executor: "constant-vus",
      vus: 20,
      duration: "2m",
      exec: "scenarioQuotes",
      startTime: "4m",
      tags: { scenario: "C_quotes" },
    },
    dividends: {
      executor: "constant-vus",
      vus: 30,
      duration: "2m",
      exec: "scenarioDividends",
      startTime: "6m",
      tags: { scenario: "D_dividends" },
    },
    screener: {
      executor: "constant-vus",
      vus: 25,
      duration: "2m",
      exec: "scenarioScreener",
      startTime: "6m",
      tags: { scenario: "E_screener" },
    },
    tax_calc: {
      executor: "constant-vus",
      vus: 10,
      duration: "2m",
      exec: "scenarioTaxCalc",
      startTime: "8m",
      tags: { scenario: "F_tax_calc" },
    },
  },
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
  const ok = check(res, { "A: status < 500": (r) => r.status < 500 });
  scenarioErrors.add(!ok);
  sleep(0.1);
}

export function scenarioSearch() {
  const url = joinBase(SEARCH_PATH);
  const res = http.get(url, { tags: { scenario: "B_search" } });
  scenarioRequests.add(1);
  searchResponse.add(res.timings.duration);
  const ok = check(res, { "B: status < 500": (r) => r.status < 500 });
  scenarioErrors.add(!ok);
  sleep(0.15);
}

export function scenarioQuotes() {
  const url = joinBase(`/api/quotes/${QUOTE_SYMBOL}`);
  const res = http.get(url, { tags: { scenario: "C_quotes" } });
  scenarioRequests.add(1);
  quotesResponse.add(res.timings.duration);
  const ok = check(res, { "C: status < 500": (r) => r.status < 500 });
  scenarioErrors.add(!ok);
  sleep(0.2);
}

export function scenarioDividends() {
  const url = joinBase(`/api/dividends/${DIVIDEND_SYMBOL}?years=5`);
  const res = http.get(url, { tags: { scenario: "D_dividends" } });
  scenarioRequests.add(1);
  dividendResponse.add(res.timings.duration);
  const ok = check(res, {
    "D: status 200": (r) => r.status === 200,
  });
  scenarioErrors.add(!ok);
  sleep(0.15);
}

export function scenarioScreener() {
  const url = joinBase("/api/screeners/dividend/growth?minYears=5&minYield=3");
  const res = http.get(url, { tags: { scenario: "E_screener" } });
  scenarioRequests.add(1);
  screenerResponse.add(res.timings.duration);
  const ok = check(res, {
    "E: status 200": (r) => r.status === 200,
  });
  scenarioErrors.add(!ok);
  sleep(0.2);
}

const TAX_BODY = JSON.stringify({
  shares: 100,
  currentPrice: 150,
  annualDividendYieldPercent: 3.5,
});

export function scenarioTaxCalc() {
  const url = joinBase("/api/dividends/tax-calculator-pl");
  const res = http.post(url, TAX_BODY, {
    headers: { "Content-Type": "application/json" },
    tags: { scenario: "F_tax_calc" },
  });
  scenarioRequests.add(1);
  taxCalcResponse.add(res.timings.duration);
  const ok = check(res, {
    "F: status 200": (r) => r.status === 200,
  });
  scenarioErrors.add(!ok);
  sleep(0.1);
}

function metricVals(m) {
  if (!m || !m.values) return null;
  return m.values;
}

function fmtNum(n) {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  return typeof n === "number" ? n.toFixed(2) : String(n);
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

  const html = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8"/>
  <title>StockAI Pro — k6 FINAL (surowy)</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; color: #1e293b; }
    h1 { border-bottom: 2px solid #0ea5e9; padding-bottom: 0.5rem; }
    table { border-collapse: collapse; width: 100%; max-width: 720px; }
    th, td { border: 1px solid #cbd5e1; padding: 0.5rem 0.75rem; text-align: left; }
    th { background: #f1f5f9; }
    code { background: #f1f5f9; padding: 0.1rem 0.35rem; }
  </style>
</head>
<body>
  <h1>k6 FINAL — fragment roboczy</h1>
  <p>Pełny raport porównawczy: <code>results/load-test-final-report.html</code> (generowany przez <code>npm run load:test:final:report</code>).</p>
  <p>Wygenerowano: <strong>${new Date().toISOString()}</strong> · <code>BASE_URL</code>=${BASE_URL}</p>
  <h2>Global http_req_duration</h2>
  ${trendTable("http_req_duration", data.metrics?.http_req_duration)}
  <h2>Scenariusze A–F (custom trends)</h2>
  ${trendTable("A homepage_response", data.metrics?.homepage_response)}
  ${trendTable("B search_response", data.metrics?.search_response)}
  ${trendTable("C quotes_response", data.metrics?.quotes_response)}
  ${trendTable("D dividend_response", data.metrics?.dividend_response)}
  ${trendTable("E screener_response", data.metrics?.screener_response)}
  ${trendTable("F tax_calc_response", data.metrics?.tax_calc_response)}
  <p>RPS: ${fmtNum(httpReqs?.rate)} · error rate: ${fmtNum(httpFail?.rate)}</p>
</body>
</html>`;

  return {
    "results/load-test-final-fragment.html": html,
    stdout: `
k6 FINAL summary
-----------------
http_reqs: ${httpReqs?.count ?? "—"} (rate: ${fmtNum(httpReqs?.rate)} req/s)
http_req_failed rate: ${fmtNum(httpFail?.rate)}
http_req_duration p50: ${fmtNum(httpDur?.med)} ms | p95: ${fmtNum(httpDur?.["p(95)"])} ms | p99: ${fmtNum(httpDur?.["p(99)"])} ms
Export: results/final-summary.json (Docker) + run npm run load:test:final:report
`,
  };
}
