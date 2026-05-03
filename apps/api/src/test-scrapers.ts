import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import {
  fetchAlphaVantageGlobalQuote,
  fetchEodhdDaily,
  fetchFinnhubQuote,
  fetchQuotesParallel,
  runScraperDemo,
} from "./scrapers/index";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

function logQuote(label: string, q: { symbol: string; price: number; timestampMs: number; source: string }): void {
  console.log(
    `${label}: ${q.symbol} @ $${q.price.toFixed(2)} (${q.source}) ts=${new Date(q.timestampMs).toISOString()}`,
  );
}

async function main(): Promise<void> {
  try {
    console.log("--- Finnhub (direct) ---");
    const fh = await fetchFinnhubQuote("AAPL");
    logQuote("OK", fh);

    console.log("\n--- Alpha Vantage (direct) ---");
    const av = await fetchAlphaVantageGlobalQuote("IBM");
    logQuote("OK", av);

    await new Promise((r) => setTimeout(r, 1200));

    console.log("\n--- EODHD (direct, last 3 bars) ---");
    try {
      const bars = await fetchEodhdDaily({ symbol: "PKNORLA", range: "1m" });
      console.log(`OK: ${bars.length} bars; last 3:`, bars.slice(-3));
    } catch (e) {
      console.warn("EODHD direct:", e instanceof Error ? e.message : e);
    }

    console.log("\n--- Orchestrator fetchQuotesParallel(AAPL) ---");
    const parallel = await fetchQuotesParallel("AAPL");
    if (parallel.finnhub.ok) logQuote("finnhub", parallel.finnhub.data);
    else console.warn("finnhub:", parallel.finnhub.message);
    if (parallel.alphaVantage.ok) logQuote("alphaVantage", parallel.alphaVantage.data);
    else console.warn("alphaVantage:", parallel.alphaVantage.message);

    await new Promise((r) => setTimeout(r, 1200));

    console.log("\n--- runScraperDemo(MSFT) ---");
    const demo = await runScraperDemo("MSFT", { symbol: "MSFT.US", range: "1m" });
    if (demo.quotes.finnhub.ok) logQuote("finnhub", demo.quotes.finnhub.data);
    else console.warn("finnhub:", demo.quotes.finnhub.message);
    if (demo.quotes.alphaVantage.ok) logQuote("alphaVantage", demo.quotes.alphaVantage.data);
    else console.warn("alphaVantage:", demo.quotes.alphaVantage.message);
    if (demo.eodhd.ok) {
      console.log(`EODHD: ${demo.eodhd.data.length} bars (last):`, demo.eodhd.data.slice(-2));
    } else {
      console.warn("EODHD:", demo.eodhd.message);
    }

    console.log("\n--- done ---");
  } catch (err) {
    console.error(err);
  }
}

main().catch(console.error);
