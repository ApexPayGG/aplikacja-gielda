import "./load-env";
import {
  fetchAlphaVantageLatestRSI,
  fetchCompanyProfile,
  fetchFinnhubCompanyNews,
  fetchFinnhubQuoteDetailed,
} from "./scrapers/index";
import { upsertCompany } from "./db/company-queries";
import { prisma } from "./db/index";
import {
  getLatestQuote,
  getRecentNews,
  insertIndicator,
  insertNews,
  insertQuote,
} from "./db/queries";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  const symbol = "AAPL";

  try {
    console.log("=== Integration: Company profile → DB ===\n");
    const profile = await fetchCompanyProfile(symbol);
    await upsertCompany(symbol, profile);
    console.log("upsertCompany:", { symbol: profile.symbol, name: profile.name, sector: profile.sector });

    console.log("\n=== Integration: Finnhub quote → DB ===\n");
    const quote = await fetchFinnhubQuoteDetailed(symbol);
    const quoteRow = await insertQuote(symbol, {
      timestamp: new Date(quote.timestampMs),
      open: quote.open,
      high: quote.high,
      low: quote.low,
      close: quote.close,
      volume: quote.volume,
      source: "finnhub",
    });
    console.log("insertQuote:", {
      id: quoteRow.id.toString(),
      symbol: quoteRow.symbol,
      timestamp: quoteRow.timestamp.toISOString(),
      ohlcv: {
        o: quoteRow.open.toString(),
        h: quoteRow.high.toString(),
        l: quoteRow.low.toString(),
        c: quoteRow.close.toString(),
        v: quoteRow.volume.toString(),
      },
      source: quoteRow.source,
    });

    console.log("\n=== Integration: Finnhub news → DB ===\n");
    const newsItems = await fetchFinnhubCompanyNews(symbol, 14);
    if (newsItems.length === 0) {
      console.warn("No Finnhub company news in range; skipping insertNews.");
    } else {
      const n = newsItems[0];
      const tsSec = n.datetime;
      const newsRow = await insertNews(symbol, {
        timestamp: new Date(tsSec < 1e12 ? tsSec * 1000 : tsSec),
        title: n.headline.slice(0, 500),
        url: n.url,
        sentiment: null,
        source: n.source || "finnhub",
      });
      console.log("insertNews:", {
        id: newsRow.id.toString(),
        symbol: newsRow.symbol,
        timestamp: newsRow.timestamp.toISOString(),
        title: newsRow.title.slice(0, 120) + (newsRow.title.length > 120 ? "…" : ""),
        url: newsRow.url.slice(0, 80) + (newsRow.url.length > 80 ? "…" : ""),
        source: newsRow.source,
      });
    }

    console.log("\n=== Integration: Alpha Vantage RSI → DB ===\n");
    await sleep(1200);
    const rsi = await fetchAlphaVantageLatestRSI(symbol, 14);
    const indRow = await insertIndicator(symbol, rsi.indicator, rsi.value);
    console.log("insertIndicator:", {
      id: indRow.id.toString(),
      symbol: indRow.symbol,
      timestamp: indRow.timestamp.toISOString(),
      indicator: indRow.indicator,
      value: indRow.value.toString(),
      avDate: rsi.date,
    });

    console.log("\n=== Query: getLatestQuote ===\n");
    const latest = await getLatestQuote(symbol);
    console.log(
      latest
        ? JSON.stringify(
            {
              id: latest.id.toString(),
              symbol: latest.symbol,
              timestamp: latest.timestamp.toISOString(),
              close: latest.close.toString(),
              volume: latest.volume.toString(),
              source: latest.source,
            },
            null,
            2,
          )
        : "(no row)",
    );

    console.log("\n=== Query: getRecentNews (limit 5) ===\n");
    const recent = await getRecentNews(symbol, 5);
    console.log(
      JSON.stringify(
        recent.map((r) => ({
          id: r.id.toString(),
          timestamp: r.timestamp.toISOString(),
          title: r.title.slice(0, 100),
          source: r.source,
        })),
        null,
        2,
      ),
    );

    console.log("\n=== Integration tests finished OK ===");
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
