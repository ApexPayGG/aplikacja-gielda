import axios from "axios";
import process from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

interface FinnhubQuoteResponse {
  c?: number;
  t?: number;
}

interface EodhdCandle {
  date: string;
  close: number;
  volume: number;
}

function formatUsd(price: number): string {
  return `$${price.toFixed(2)}`;
}

function finnhubTimestampToIso(t: number): string {
  const ms = t < 1e12 ? t * 1000 : t;
  return new Date(ms).toISOString();
}

async function testFinnhub(): Promise<void> {
  const token = process.env.FINNHUB_API_KEY;
  if (!token) {
    throw new Error("FINNHUB_API_KEY is not set");
  }

  const url = `https://finnhub.io/api/v1/quote?symbol=AAPL&token=${encodeURIComponent(token)}`;
  const { data } = await axios.get<FinnhubQuoteResponse>(url);

  const price = data.c;
  const rawTs = data.t;

  if (price == null || rawTs == null) {
    throw new Error(`Unexpected Finnhub response: ${JSON.stringify(data)}`);
  }

  const timestamp = finnhubTimestampToIso(rawTs);

  console.log(`Finnhub AAPL: Price: ${formatUsd(price)}, Timestamp: ${timestamp}`);
}

async function testEODHD(): Promise<void> {
  const token = process.env.EODHD_API_KEY;
  if (!token) {
    throw new Error("EODHD_API_KEY is not set");
  }

  const url =
    "https://api.eodhistoricaldata.com/api/eod/PKNORLA" +
    `?api_token=${encodeURIComponent(token)}&period=d&fmt=json&range=1m`;

  try {
    const httpsAgent = new (await import("https")).Agent({
      rejectUnauthorized: false,
    });

    const response = await axios.get<EodhdCandle[]>(url, { httpsAgent });
    const { data } = response;

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error(`Unexpected EODHD response: ${JSON.stringify(data)}`);
    }

    const lastFive = data.slice(-5);
    const lines = lastFive.map(
      (c) => `  ${c.date} | close: ${formatUsd(Number(c.close))} | volume: ${c.volume}`,
    );

    console.log(`---\nEODHD PKNORLA (last 5 daily candles):\n${lines.join("\n")}\n---`);
  } catch (err) {
    if (axios.isAxiosError(err)) {
      console.log(
        `⚠️  EODHD: Currently unavailable on this plan (EOD All World Basic).
        Will work after plan upgrade to Extended.`,
      );
      return;
    }
    console.error(err);
  }
}

async function main(): Promise<void> {
  try {
    await testFinnhub();
    await testEODHD();
  } catch (err) {
    console.error(err);
  }
}

main().catch(console.error);
