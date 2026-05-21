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
import { registerDividendAlertsJob, scheduleDailyDividendAlerts } from "./modules/dividend/dividendModule";
import { registerExitMonitorJob, scheduleExitMonitor } from "./modules/exitIntelligence/exitIntelligence";
import { registerAlphaCalendarJob, scheduleDailyAlphaCalendar } from "./modules/alphaCalendar/alphaCalendar";
import { registerDailyDigestJob, scheduleDailyDigestJob } from "./modules/digest/digestModule";
import {
  registerOnboardingSequenceJob,
  scheduleOnboardingSequenceJob,
} from "./modules/email/onboardingSequence";
import { registerPortfolioSnapshots, scheduleDailyPortfolioSnapshotsJob } from "./jobs/portfolioSnapshots";
import { registerFetchPolygonQuotes, scheduleFetchPolygonQuotesJob } from "./jobs/fetchPolygonQuotes";
import {
  registerEodhdGlobalImport,
  registerEodhdGpwImport,
  scheduleDailyEodhdGlobalImportJob,
  scheduleDailyEodhdGpwImportJob,
} from "./jobs/eodhdImports";
import {
  registerMarketEventsDigest,
  scheduleDailyMarketEventsDigest,
} from "./jobs/marketEventsDigest";
import {
  registerMarketEventsSync,
  scheduleDailyMarketEventsSync,
} from "./jobs/syncMarketEvents";
import {
  ingestLogger,
  runIngestJob,
  STANDARD_INGEST_JOB_OPTIONS,
  WEEKDAY_REALTIME_CRON,
} from "./jobs/schedulerConfig";

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
  await runIngestJob(
    { queue: QUEUE_NAME, provider: "finnhub+alpha_vantage", jobName: "hourly-scrape" },
    async () => {
      for (const sym of SYMBOLS) {
        try {
          await scrapeSymbol(sym);
        } catch (e) {
          ingestLogger.error({
            event: "symbol_scrape_failed",
            provider: "finnhub",
            symbol: sym,
            err: e instanceof Error ? e.message : String(e),
          });
        }
        await sleep(2000);
      }
    },
  );
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
  const eodhdGpwConn = createRedisConnection();
  const eodhdGpwWorkerConn = createRedisConnection();
  const eodhdGlobalConn = createRedisConnection();
  const eodhdGlobalWorkerConn = createRedisConnection();
  const digestConn = createRedisConnection();
  const digestWorkerConn = createRedisConnection();
  const onboardingConn = createRedisConnection();
  const onboardingWorkerConn = createRedisConnection();
  const marketEventsConn = createRedisConnection();
  const marketEventsWorkerConn = createRedisConnection();
  const marketEventsDigestConn = createRedisConnection();
  const marketEventsDigestWorkerConn = createRedisConnection();

  const queue = new Queue(QUEUE_NAME, {
    connection,
    defaultJobOptions: { ...STANDARD_INGEST_JOB_OPTIONS },
  });
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
      repeat: {
        pattern: WEEKDAY_REALTIME_CRON.HOURLY,
        tz: "Etc/UTC",
      },
      jobId: "hourly-scrape-weekdays",
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
  const { queue: dividendModuleQueue, worker: dividendModuleWorker } = registerDividendAlertsJob();
  dividendModuleWorker.on("failed", (job, err) => {
    console.error(`[scheduler] dividend module alerts job ${job?.id} failed`, err);
  });
  dividendModuleWorker.on("completed", (job) => {
    console.log(`[scheduler] dividend module alerts job ${job.id} completed`);
  });
  await scheduleDailyDividendAlerts(dividendModuleQueue);

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

  const { queue: dailyDigestQueue, worker: dailyDigestWorker } = registerDailyDigestJob(
    digestConn,
    digestWorkerConn,
  );
  dailyDigestWorker.on("failed", (job, err) => {
    console.error(`[scheduler] daily digest job ${job?.id} failed`, err);
  });
  dailyDigestWorker.on("completed", (job) => {
    console.log(`[scheduler] daily digest job ${job.id} completed`);
  });
  await scheduleDailyDigestJob(dailyDigestQueue);
  const { queue: onboardingQueue, worker: onboardingWorker } = registerOnboardingSequenceJob(
    onboardingConn,
    onboardingWorkerConn,
  );
  onboardingWorker.on("failed", (job, err) => {
    console.error(`[scheduler] onboarding sequence job ${job?.id} failed`, err);
  });
  onboardingWorker.on("completed", (job) => {
    console.log(`[scheduler] onboarding sequence job ${job.id} completed`);
  });
  await scheduleOnboardingSequenceJob(onboardingQueue);

  const { queue: fundQueue, worker: fundWorker } = registerFundamentalSync(fundConn, fundWorkerConn);
  fundWorker.on("failed", (job, err) => {
    console.error(`[scheduler] fundamental job ${job?.id} failed`, err);
  });
  fundWorker.on("completed", (job) => {
    console.log(`[scheduler] fundamental job ${job.id} completed`);
  });
  await scheduleDailyFundamentalJob(fundQueue);

  const { queue: eodhdGpwQueue, worker: eodhdGpwWorker } = registerEodhdGpwImport(
    eodhdGpwConn,
    eodhdGpwWorkerConn,
  );
  eodhdGpwWorker.on("failed", (job, err) => {
    console.error(`[scheduler] eodhd gpw import job ${job?.id} failed`, err);
  });
  eodhdGpwWorker.on("completed", (job) => {
    console.log(`[scheduler] eodhd gpw import job ${job.id} completed`);
  });
  await scheduleDailyEodhdGpwImportJob(eodhdGpwQueue);

  const { queue: eodhdGlobalQueue, worker: eodhdGlobalWorker } = registerEodhdGlobalImport(
    eodhdGlobalConn,
    eodhdGlobalWorkerConn,
  );
  eodhdGlobalWorker.on("failed", (job, err) => {
    console.error(`[scheduler] eodhd global import job ${job?.id} failed`, err);
  });
  eodhdGlobalWorker.on("completed", (job) => {
    console.log(`[scheduler] eodhd global import job ${job.id} completed`);
  });
  await scheduleDailyEodhdGlobalImportJob(eodhdGlobalQueue);

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
      ingestLogger.error({
        event: "worker_job_failed",
        queue: "fetch-quotes",
        provider: "polygon",
        jobId: job?.id,
        err: err instanceof Error ? err.message : String(err),
      });
    });
    fetchQuotesWorker.on("completed", (job) => {
      ingestLogger.info({
        event: "worker_job_completed",
        queue: "fetch-quotes",
        provider: "polygon",
        jobId: job.id,
      });
    });
    await scheduleFetchPolygonQuotesJob(fetchQuotesQueue);
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
  const { queue: exitMonitorQueue, worker: exitMonitorWorker } = registerExitMonitorJob();
  exitMonitorWorker.on("failed", (job, err) => {
    console.error(`[scheduler] exit monitor job ${job?.id} failed`, err);
  });
  exitMonitorWorker.on("completed", (job) => {
    console.log(`[scheduler] exit monitor job ${job.id} completed`);
  });
  await scheduleExitMonitor(exitMonitorQueue);
  const { queue: alphaCalendarQueue, worker: alphaCalendarWorker } = registerAlphaCalendarJob();
  alphaCalendarWorker.on("failed", (job, err) => {
    console.error(`[scheduler] alpha calendar job ${job?.id} failed`, err);
  });
  alphaCalendarWorker.on("completed", (job) => {
    console.log(`[scheduler] alpha calendar job ${job.id} completed`);
  });
  await scheduleDailyAlphaCalendar(alphaCalendarQueue);

  const { queue: marketEventsQueue, worker: marketEventsWorker } = registerMarketEventsSync(
    marketEventsConn,
    marketEventsWorkerConn,
  );
  marketEventsWorker.on("failed", (job, err) => {
    console.error(`[scheduler] market events sync job ${job?.id} failed`, err);
  });
  marketEventsWorker.on("completed", (job) => {
    console.log(`[scheduler] market events sync job ${job.id} completed`);
  });
  await scheduleDailyMarketEventsSync(marketEventsQueue);

  const { queue: marketEventsDigestQueue, worker: marketEventsDigestWorker } = registerMarketEventsDigest(
    marketEventsDigestConn,
    marketEventsDigestWorkerConn,
  );
  marketEventsDigestWorker.on("failed", (job, err) => {
    console.error(`[scheduler] market events digest job ${job?.id} failed`, err);
  });
  marketEventsDigestWorker.on("completed", (job) => {
    console.log(`[scheduler] market events digest job ${job.id} completed`);
  });
  await scheduleDailyMarketEventsDigest(marketEventsDigestQueue);

  console.log("[scheduler] BullMQ worker started; hourly job scheduled");
  console.log("[scheduler] Dividend hybrid sync: daily @ 01:00 UTC (queue dividend-sync)");
  console.log("[scheduler] Dividend alerts: daily @ 06:00 UTC (queue dividend-alerts)");
  console.log("[scheduler] Dividend module ex-date alerts: daily @ 08:00 UTC (queue dividend-module-alerts)");
  console.log("[scheduler] Portfolio snapshots: daily @ 17:00 UTC (queue portfolio-snapshots)");
  console.log("[scheduler] Daily digest email: daily @ 08:00 UTC (queue daily-digest-email)");
  console.log("[scheduler] Onboarding email sequence: every 1 hour (queue onboarding-email-sequence)");
  console.log("[scheduler] Fundamentals (EODHD): weekdays @ 03:00 UTC (queue fundamental-sync)");
  console.log("[scheduler] EODHD GPW import: weekdays @ 01:30 UTC (queue eodhd-import-gpw)");
  console.log("[scheduler] EODHD global import: weekdays @ 02:00 UTC (queue eodhd-import-global)");
  console.log("[scheduler] Market scrape: hourly Mon–Fri UTC (queue market-scrape; Finnhub + Alpha Vantage)");
  console.log("[scheduler] Scan signals: every 5 min Mon–Fri UTC (queue scan-signals)");
  console.log("[scheduler] Discord signal alerts: dispatch + batch flush every 1 minute");
  console.log("[scheduler] Exit intelligence monitor: every 15 minutes (queue exit-monitor)");
  console.log("[scheduler] Alpha calendar: daily @ 07:00 UTC (queue alpha-calendar)");
  console.log("[scheduler] Market events sync: weekdays @ 05:30 UTC (queue market-events-sync)");
  console.log("[scheduler] Market events digest: weekdays @ 07:00 UTC (queue market-events-digest)");
  if (process.env.POLYGON_API_KEY) {
    console.log("[scheduler] Polygon live quotes: every 5 min Mon–Fri UTC (queue fetch-quotes)");
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
