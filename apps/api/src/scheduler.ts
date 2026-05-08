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
import { registerFundamentalSync, scheduleDailyFundamentalJob } from "./jobs/syncFundamentals";
import { registerDividendSync, scheduleDailyDividendJob } from "./jobs/syncDividends";
import { registerDividendAlerts, scheduleDailyDividendAlertsJob } from "./jobs/dividendAlerts";
import { registerScanSignals, scheduleScanSignalsJob } from "./jobs/scanSignals";
import { processSignalQueue } from "./jobs/queues/processSignal";
import { registerProcessSignal } from "./jobs/processSignal";
import { registerDiscordSignalAlerts, scheduleDiscordBatchFlush } from "./jobs/discordSignalAlerts";
import { registerPortfolioSnapshots, scheduleDailyPortfolioSnapshotsJob } from "./jobs/portfolioSnapshots";
import { registerFetchPolygonQuotes } from "./jobs/fetchPolygonQuotes";

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
  const divConn = createRedisConnection();
  const divWorkerConn = createRedisConnection();
  const fundConn = createRedisConnection();
  const fundWorkerConn = createRedisConnection();
  const scanConn = createRedisConnection();
  const scanWorkerConn = createRedisConnection();
  const divAlertsConn = createRedisConnection();
  const divAlertsWorkerConn = createRedisConnection();
  const portfolioConn = createRedisConnection();
  const portfolioWorkerConn = createRedisConnection();
  const fetchQuotesConn = createRedisConnection();
  const fetchQuotesWorkerConn = createRedisConnection();

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

  const { queue: divQueue, worker: divWorker } = registerDividendSync(divConn, divWorkerConn);

  divWorker.on("failed", (job, err) => {
    console.error(`[scheduler] dividend job ${job?.id} failed`, err);
  });
  divWorker.on("completed", (job) => {
    console.log(`[scheduler] dividend job ${job.id} completed`);
  });

  await scheduleDailyDividendJob(divQueue);

  const { queue: dividendAlertsQueue, worker: dividendAlertsWorker } = registerDividendAlerts(
    divAlertsConn,
    divAlertsWorkerConn,
  );
  dividendAlertsWorker.on("failed", (job, err) => {
    console.error(`[scheduler] dividend alerts job ${job?.id} failed`, err);
  });
  dividendAlertsWorker.on("completed", (job) => {
    console.log(`[scheduler] dividend alerts job ${job.id} completed`);
  });
  await scheduleDailyDividendAlertsJob(dividendAlertsQueue);

  const { queue: portfolioQueue, worker: portfolioWorker } = registerPortfolioSnapshots(
    portfolioConn,
    portfolioWorkerConn,
  );
  portfolioWorker.on("failed", (job, err) => {
    console.error(`[scheduler] portfolio snapshots job ${job?.id} failed`, err);
  });
  portfolioWorker.on("completed", (job) => {
    console.log(`[scheduler] portfolio snapshots job ${job.id} completed`);
  });
  await scheduleDailyPortfolioSnapshotsJob(portfolioQueue);

  const { queue: fundQueue, worker: fundWorker } = registerFundamentalSync(fundConn, fundWorkerConn);
  fundWorker.on("failed", (job, err) => {
    console.error(`[scheduler] fundamental job ${job?.id} failed`, err);
  });
  fundWorker.on("completed", (job) => {
    console.log(`[scheduler] fundamental job ${job.id} completed`);
  });
  await scheduleDailyFundamentalJob(fundQueue);

  const { queue: scanQueue, worker: scanWorker } = registerScanSignals(scanConn, scanWorkerConn);
  scanWorker.on("failed", (job, err) => {
    console.error(`[scheduler] signals scan job ${job?.id} failed`, err);
  });
  scanWorker.on("completed", (job) => {
    console.log(`[scheduler] signals scan job ${job.id} completed`);
  });
  await scheduleScanSignalsJob(scanQueue);

  if (process.env.POLYGON_API_KEY) {
    const { queue: fetchQuotesQueue, worker: fetchQuotesWorker } = registerFetchPolygonQuotes(
      fetchQuotesConn,
      fetchQuotesWorkerConn,
    );
    fetchQuotesWorker.on("failed", (job, err) => {
      console.error(`[scheduler] polygon fetch quotes job ${job?.id} failed`, err);
    });
    fetchQuotesWorker.on("completed", (job) => {
      console.log(`[scheduler] polygon fetch quotes job ${job.id} completed`);
    });
  } else {
    console.log("[scheduler] Polygon live quotes: disabled (POLYGON_API_KEY not set)");
  }

  // Register process signal worker
  registerProcessSignal(processSignalQueue);
  const { queue: discordAlertsQueue, worker: discordAlertsWorker } = registerDiscordSignalAlerts();
  discordAlertsWorker.on("failed", (job, err) => {
    console.error(`[scheduler] discord signal alert job ${job?.id} failed`, err);
  });
  discordAlertsWorker.on("completed", (job) => {
    console.log(`[scheduler] discord signal alert job ${job.id} completed`);
  });
  await scheduleDiscordBatchFlush(discordAlertsQueue);

  console.log("[scheduler] BullMQ worker started; hourly job scheduled");
  console.log("[scheduler] Dividend hybrid sync: daily @ 01:00 UTC (queue dividend-sync)");
  console.log("[scheduler] Dividend alerts: daily @ 06:00 UTC (queue dividend-alerts)");
  console.log("[scheduler] Portfolio snapshots: daily @ 17:00 UTC (queue portfolio-snapshots)");
  console.log("[scheduler] Fundamentals (EODHD): daily @ 03:00 UTC (queue fundamental-sync)");
  console.log("[scheduler] Scan signals: every 5 minutes (queue scan:signals)");
  console.log("[scheduler] Discord signal alerts: dispatch + batch flush every 1 minute");
  if (process.env.POLYGON_API_KEY) {
    console.log(
      "[scheduler] Polygon live quotes: worker ready (enqueue via GitHub cron or `npm run job:fetch-quotes`)",
    );
  }
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
