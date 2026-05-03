import { Queue, Worker } from "bullmq";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createRedisConnection } from "./redis";
import {
  fetchAlphaVantageLatestRSI,
  fetchCompanyProfile,
  fetchFinnhubCompanyNews,
  fetchFinnhubQuoteDetailed,
} from "./scrapers/index";
import { upsertCompany } from "./db/company-queries";
import { insertIndicator, insertNews, insertQuote } from "./db/queries";

const QUEUE_NAME = "market-scrape";
const SYMBOLS = ["AAPL", "GOOGL", "MSFT"] as const;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function scrapeSymbol(symbol: string): Promise<void> {
  const sym = symbol.toUpperCase();

  const profile = await fetchCompanyProfile(sym);
  await upsertCompany(sym, profile);

  const quote = await fetchFinnhubQuoteDetailed(sym);
  try {
    await insertQuote(sym, {
      timestamp: new Date(quote.timestampMs),
      open: quote.open,
      high: quote.high,
      low: quote.low,
      close: quote.close,
      volume: quote.volume,
      source: "finnhub",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Unique constraint") || msg.includes("P2002")) {
      console.log(`[scheduler] quote skip duplicate ${sym}`);
    } else {
      throw e;
    }
  }

  const news = await fetchFinnhubCompanyNews(sym, 3);
  if (news.length > 0) {
    const n = news[0];
    const ts = n.datetime < 1e12 ? n.datetime * 1000 : n.datetime;
    try {
      await insertNews(sym, {
        timestamp: new Date(ts),
        title: n.headline.slice(0, 500),
        url: n.url,
        sentiment: null,
        source: n.source || "finnhub",
      });
    } catch (e) {
      console.warn(`[scheduler] news insert ${sym}:`, e instanceof Error ? e.message : e);
    }
  }

  await sleep(1500);
  const rsi = await fetchAlphaVantageLatestRSI(sym, 14);
  await insertIndicator(sym, rsi.indicator, rsi.value);
  console.log(`[scheduler] done ${sym} RSI=${rsi.value}`);
}

async function runHourlyJob(): Promise<void> {
  console.log(`[scheduler] hourly job start ${new Date().toISOString()}`);
  for (const sym of SYMBOLS) {
    try {
      await scrapeSymbol(sym);
    } catch (e) {
      console.error(`[scheduler] FAILED ${sym}:`, e);
    }
    await sleep(2000);
  }
  console.log(`[scheduler] hourly job end ${new Date().toISOString()}`);
}

/**
 * BullMQ worker + repeatable hourly scrape (Finnhub quotes/news + Alpha RSI → DB).
 */
export async function startScheduler(): Promise<void> {
  const connection = createRedisConnection();
  const duplicate = createRedisConnection();

  const queue = new Queue(QUEUE_NAME, { connection });
  const worker = new Worker(QUEUE_NAME, () => runHourlyJob(), { connection: duplicate });

  worker.on("failed", (job, err) => {
    console.error(`[scheduler] job ${job?.id} failed`, err);
  });
  worker.on("completed", (job) => {
    console.log(`[scheduler] job ${job.id} completed`);
  });

  await queue.add(
    "hourly-scrape",
    {},
    {
      repeat: { every: 60 * 60 * 1000 },
      jobId: "hourly-scrape-all",
    },
  );

  console.log("[scheduler] BullMQ worker started; hourly job scheduled");
}

const schedulerFile = path.resolve(fileURLToPath(import.meta.url));
const entryFile = process.argv[1] ? path.resolve(process.argv[1]) : "";
const runSchedulerCli = entryFile === schedulerFile;

if (runSchedulerCli) {
  await import("./load-env");
  startScheduler().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
