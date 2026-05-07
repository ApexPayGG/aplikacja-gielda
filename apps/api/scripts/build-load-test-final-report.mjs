/**
 * Łączy baseline-summary.json + final-summary.json (k6 --summary-export)
 * → results/load-test-final-report.html oraz results/load-test-comparison.csv
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resultsDir = path.join(__dirname, "..", "results");
const baselinePath = path.join(resultsDir, "baseline-summary.json");
const finalPath = path.join(resultsDir, "final-summary.json");
const htmlOut = path.join(resultsDir, "load-test-final-report.html");
const csvOut = path.join(resultsDir, "load-test-comparison.csv");

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

/** k6 --summary-export: statystyki trendu na obiekcie metryki lub w .values */
function trendValues(summary, name) {
  const m = summary?.metrics?.[name];
  if (!m) return null;
  if (m.values && typeof m.values === "object" && (m.values.med !== undefined || m.values["p(95)"] !== undefined)) {
    return m.values;
  }
  if (m.med !== undefined || m["p(95)"] !== undefined) return m;
  return null;
}

function fmt(n) {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  return typeof n === "number" ? n.toFixed(2) : String(n);
}

function rowScenario(id, label, trendName, baseline, finalSummary) {
  const b = trendValues(baseline, trendName);
  const f = trendValues(finalSummary, trendName);
  const bp95 = b?.["p(95)"];
  const fp95 = f?.["p(95)"];
  let diffMs = "—";
  let impr = "—";
  if (typeof bp95 === "number" && typeof fp95 === "number") {
    diffMs = (fp95 - bp95).toFixed(2);
    if (bp95 !== 0) impr = (((bp95 - fp95) / bp95) * 100).toFixed(1);
  }
  return { id, label, trendName, b, f, bp95, fp95, diffMs, impr };
}

function globalBlock(label, summary) {
  const durM = summary?.metrics?.http_req_duration;
  const dur = durM?.values ?? durM;
  const failM = summary?.metrics?.http_req_failed;
  const failRate = typeof failM?.value === "number" ? failM.value : failM?.values?.rate;
  const reqsM = summary?.metrics?.http_reqs;
  const rps = reqsM?.rate ?? reqsM?.values?.rate;
  if (!dur?.med && failRate === undefined && rps === undefined) {
    return `<p><em>Brak danych (${label}).</em></p>`;
  }
  return `<table>
    <thead><tr><th>Metryka</th><th>Wartość</th></tr></thead>
    <tbody>
      <tr><td>RPS (http_reqs rate)</td><td>${fmt(rps)}</td></tr>
      <tr><td>Error rate (http_req_failed)</td><td>${fmt(failRate)}</td></tr>
      <tr><td>p50 (med)</td><td>${fmt(dur?.med)} ms</td></tr>
      <tr><td>p95</td><td>${fmt(dur?.["p(95)"])} ms</td></tr>
      <tr><td>p99</td><td>${fmt(dur?.["p(99)"])} ms</td></tr>
    </tbody>
  </table>`;
}

function comparisonTable(rows) {
  const head =
    "<thead><tr><th>Scenariusz</th><th>p50 base</th><th>p50 final</th><th>p95 base</th><th>p95 final</th><th>p99 base</th><th>p99 final</th></tr></thead>";
  const body = rows
    .map((r) => {
      const b = r.b;
      const f = r.f;
      return `<tr>
        <td><strong>${r.id}</strong> ${r.label}</td>
        <td>${fmt(b?.med)}</td>
        <td>${fmt(f?.med)}</td>
        <td>${fmt(b?.["p(95)"])}</td>
        <td>${fmt(f?.["p(95)"])}</td>
        <td>${fmt(b?.["p(99)"])}</td>
        <td>${fmt(f?.["p(99)"])}</td>
      </tr>`;
    })
    .join("");
  return `<table>${head}<tbody>${body}</tbody></table>`;
}

function analysisText(rows, baselineSummary, finalSummary) {
  const lines = [];
  const abc = rows.filter((r) => ["A", "B", "C"].includes(r.id));
  let worse = 0;
  let better = 0;
  for (const r of abc) {
    if (typeof r.bp95 === "number" && typeof r.fp95 === "number") {
      if (r.fp95 > r.bp95 * 1.1) worse++;
      if (r.fp95 < r.bp95 * 0.9) better++;
    }
  }
  if (!baselineSummary) {
    lines.push(
      "Brak pliku baseline-summary.json — porównanie A–C jest niepełne. Uruchom wcześniej: npm run load:test:baseline:export",
    );
  } else if (worse > better) {
    lines.push(
      "Dla scenariuszy A–C mediana scenariuszy wskazuje wyższe p95 w teście FINAL niż w baseline — możliwa kontencja zasobów (CPU/DB) przy pełnej sesji lub inny stan cache/Redis.",
    );
  } else if (better > worse) {
    lines.push(
      "Dla A–C p95 w FINAL jest nieco niższe lub zbliżone — baseline nie wygląda na zdegradowany; Redis może obniżać koszt powtarzalnych zapytań (quotes/search) po rozgrzaniu.",
    );
  } else {
    lines.push(
      "A–C: p95 zbliżone między baseline a FINAL — brak wyraźnej degradacji; różnice mogą wynikać z szumu pomiaru i stanu cache.",
    );
  }

  const failB = baselineSummary?.metrics?.http_req_failed;
  const failF = finalSummary?.metrics?.http_req_failed;
  const erB = typeof failB?.value === "number" ? failB.value : failB?.values?.rate;
  const erF = typeof failF?.value === "number" ? failF.value : failF?.values?.rate;
  if (typeof erF === "number" && erF > 0.05) {
    lines.push(
      `Wysoki globalny error rate w FINAL (${(erF * 100).toFixed(1)}%): często 404 na /api/quotes gdy brak notowania w DB — sprawdź seed i dane; baseline ${typeof erB === "number" ? (erB * 100).toFixed(1) + "%" : "—"}.`,
    );
  }
  lines.push(
    "Redis: przy powtarzających się GET /api/quotes i /api/companies/search oczekuj spadku opóźnień po pierwszym żądaniu (TTL w config/redis.ts). Dywidendy i screener korzystają z cache Redis — drugie i kolejne żądania tego samego klucza powinny być szybsze w realnym ruchu.",
  );
  lines.push(
    "Wąskie gardła: screener (agregacja wielu wierszy w DB) oraz pierwsze trafienia bez cache; tax-calculator jest lekki (CPU), ale pod obciążeniem sprawdź event loop.",
  );
  return lines.map((t) => `<div class="hint">${t}</div>`).join("");
}

function main() {
  if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

  const baseline = readJson(baselinePath);
  const finalSummary = readJson(finalPath);

  if (!finalSummary) {
    console.error("Brak results/final-summary.json — uruchom najpierw npm run load:test:final:export");
    process.exit(1);
  }

  const scenarios = [
    rowScenario("A", "GET health/home", "homepage_response", baseline, finalSummary),
    rowScenario("B", "GET search", "search_response", baseline, finalSummary),
    rowScenario("C", "GET quotes", "quotes_response", baseline, finalSummary),
    rowScenario("D", "GET dividends", "dividend_response", baseline, finalSummary),
    rowScenario("E", "GET screener", "screener_response", baseline, finalSummary),
    rowScenario("F", "POST tax PL", "tax_calc_response", baseline, finalSummary),
  ];

  const csvLines = [
    "scenario,baseline_p95,final_p95,difference_ms,improvement_%",
    ...scenarios.map((r) => {
      const bp = typeof r.bp95 === "number" ? r.bp95.toFixed(2) : "";
      const fp = typeof r.fp95 === "number" ? r.fp95.toFixed(2) : "";
      const imp = r.impr === "—" ? "" : r.impr;
      return `${r.id},${bp},${fp},${r.diffMs === "—" ? "" : r.diffMs},${imp}`;
    }),
  ];
  fs.writeFileSync(csvOut, csvLines.join("\n"), "utf8");

  const html = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8"/>
  <title>StockAI Pro — Load test FINAL vs baseline</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; color: #1e293b; max-width: 1100px; }
    h1 { border-bottom: 2px solid #0ea5e9; padding-bottom: 0.5rem; }
    h2 { margin-top: 2rem; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th, td { border: 1px solid #cbd5e1; padding: 0.5rem 0.75rem; text-align: left; }
    th { background: #f1f5f9; }
    .hint { background: #eff6ff; border-left: 4px solid #2563eb; padding: 0.75rem 1rem; margin: 0.5rem 0; }
    code { background: #f1f5f9; padding: 0.1rem 0.35rem; }
    .ok { color: #15803d; }
    .warn { color: #c2410c; }
  </style>
</head>
<body>
  <h1>StockAI Pro — raport obciążeniowy: <span class="ok">FINAL</span> vs <span class="warn">baseline</span></h1>
  <p>Wygenerowano: <strong>${new Date().toISOString()}</strong></p>
  <p>Baseline: <code>results/baseline-summary.json</code> ${baseline ? "✓" : "✗ brak"} · Final: <code>results/final-summary.json</code> ✓</p>
  <p>CSV: <code>results/load-test-comparison.csv</code></p>

  <h2>1. Metryki globalne (http_req_*)</h2>
  <h3>Baseline (tylko A–C, ~6 min)</h3>
  ${globalBlock("baseline", baseline)}
  <h3>FINAL (A–F, ~10 min)</h3>
  ${globalBlock("final", finalSummary)}

  <h2>2. Porównanie scenariuszy (p50 / p95 / p99, ms)</h2>
  <p>Dla D–E–F baseline jest puste — pierwszy pomiar w kolumnie „final”.</p>
  ${comparisonTable(scenarios)}

  <h2>3. CSV — interpretacja</h2>
  <p><code>improvement_percent</code> = <code>(baseline_p95 - final_p95) / baseline_p95 × 100</code>. Wartość dodatnia = krótszy czas odpowiedzi w FINAL (lepiej).</p>

  <h2>4. Analiza (heurystyka)</h2>
  ${analysisText(scenarios, baseline, finalSummary)}

  <h2>5. Opis scenariuszy FINAL</h2>
  <ul>
    <li><strong>A</strong>: 100 VU × 2 min — GET health</li>
    <li><strong>B</strong>: 50 VU × 2 min — GET company search</li>
    <li><strong>C</strong>: 20 VU × 2 min — GET quote</li>
    <li><strong>D</strong>: 30 VU × 2 min — GET /api/dividends/AAPL?years=5</li>
    <li><strong>E</strong>: 25 VU × 2 min — GET screener growth</li>
    <li><strong>F</strong>: 10 VU × 2 min — POST tax calculator</li>
  </ul>
  <p>Oś czasu: A→B→C sekwencyjnie; D i E równolegle (6–8 min); F (8–10 min).</p>
</body>
</html>`;

  fs.writeFileSync(htmlOut, html, "utf8");
  console.log("Zapisano:", htmlOut);
  console.log("Zapisano:", csvOut);
}

main();
