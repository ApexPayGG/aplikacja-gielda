import Anthropic from "@anthropic-ai/sdk";
import process from "node:process";
import { prisma } from "../../db/index";

const CROWD_WISDOM_MODEL = "claude-sonnet-4-20250514";
const SIGNAL_SAMPLE_SIZE = 50;
const INSIDER_WINDOW_DAYS = 30;
const SIGNAL_DIVERGENCE_THRESHOLD = 15;

type SignalValue = "CONTRARIAN_BUY" | "CONTRARIAN_SELL" | "NEUTRAL";

export type CrowdWisdomResult = {
  symbol: string;
  retailBullish: number;
  insiderBuying: number;
  divergence: number;
  insight: string;
  signal: SignalValue;
};

type InsiderRow = Record<string, unknown>;

type DbLike = {
  signal: {
    findMany: (args: Record<string, unknown>) => Promise<Array<{ pattern_type: string; technical_data: unknown }>>;
  };
};

type ModuleDeps = {
  db: DbLike;
  fetchInsiderFn: (symbol: string) => Promise<InsiderRow[]>;
  writeInsightFn: (retailBullish: number, insiderBuying: number) => Promise<string>;
};

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function retailDirection(row: { pattern_type: string; technical_data: unknown }): "BULLISH" | "BEARISH" | "UNKNOWN" {
  const pattern = String(row.pattern_type ?? "").toLowerCase();
  const technicalJson = JSON.stringify(row.technical_data ?? {}).toLowerCase();
  const text = `${pattern} ${technicalJson}`;

  if (
    text.includes("bearish") ||
    text.includes("bear") ||
    text.includes("short") ||
    text.includes("breakdown")
  ) {
    return "BEARISH";
  }

  if (
    text.includes("bullish") ||
    text.includes("bull") ||
    text.includes("long") ||
    text.includes("breakout") ||
    text.includes("momentum") ||
    text.includes("oversold") ||
    text.includes("bounce")
  ) {
    return "BULLISH";
  }

  return "UNKNOWN";
}

function parseDateFromInsiderRow(row: InsiderRow): Date | null {
  const raw =
    row.transaction_date ??
    row.transactionDate ??
    row.date ??
    row.filing_date ??
    row.filingDate ??
    row.filed_at;
  if (!raw) return null;
  const d = new Date(String(raw));
  return Number.isNaN(d.getTime()) ? null : d;
}

function insiderSide(row: InsiderRow): "BUY" | "SELL" | "UNKNOWN" {
  const rawType =
    row.transaction_type ??
    row.transactionType ??
    row.type ??
    row.action ??
    row.code ??
    row.transaction_code;
  const text = String(rawType ?? "").trim().toLowerCase();
  if (!text) return "UNKNOWN";

  if (
    text === "p" ||
    text === "b" ||
    text.includes("buy") ||
    text.includes("purchase") ||
    text.includes("acquir")
  ) {
    return "BUY";
  }

  if (
    text === "s" ||
    text.includes("sell") ||
    text.includes("sale") ||
    text.includes("dispos")
  ) {
    return "SELL";
  }

  return "UNKNOWN";
}

function parseInsightJson(raw: string): string {
  const match = raw.match(/\{[\s\S]*\}/);
  const payload = match ? match[0] : raw;

  try {
    const parsed = JSON.parse(payload) as { insight?: unknown };
    const insight = String(parsed.insight ?? "")
      .trim()
      .replace(/\s+/g, " ");
    if (insight) return insight;
  } catch {
    // fallback below
  }

  return (
    raw
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 180) || "Retail and insider data are mixed; contrarian edge is currently limited."
  );
}

async function fetchInsiderByCode(code: string, token: string): Promise<InsiderRow[] | null> {
  const params = new URLSearchParams({
    code,
    api_token: token,
    fmt: "json",
  });

  const url = `https://eodhd.com/api/insider-transactions?${params.toString()}`;
  const response = await fetch(url);
  const bodyText = await response.text();

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`EODHD insider-transactions HTTP ${response.status}: ${bodyText.slice(0, 300)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    throw new Error(`EODHD insider-transactions invalid JSON: ${bodyText.slice(0, 200)}`);
  }

  if (!Array.isArray(parsed)) return [];
  return parsed as InsiderRow[];
}

async function fetchInsiderTransactionsFromEodhd(symbol: string): Promise<InsiderRow[]> {
  const token = process.env.EODHD_API_KEY?.trim();
  if (!token) {
    throw new Error("EODHD_API_KEY is not set. Crowd Wisdom requires insider data from EODHD.");
  }

  const upper = symbol.trim().toUpperCase();
  if (upper.includes(".")) {
    return (await fetchInsiderByCode(upper, token)) ?? [];
  }

  // Prefer Warsaw format for local tickers, then fallback to raw US format.
  const firstTry = await fetchInsiderByCode(`${upper}.WAR`, token);
  if (firstTry !== null && firstTry.length > 0) return firstTry;

  const secondTry = await fetchInsiderByCode(upper, token);
  if (secondTry !== null) return secondTry;

  return firstTry ?? [];
}

async function writeContrarianInsightWithClaude(retailBullish: number, insiderBuying: number): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set. Crowd Wisdom insight requires Claude.");
  }

  const prompt = `Retail: ${retailBullish}% bullish. Insiders: ${insiderBuying}% buying last 30d.
Write 1 contrarian insight, max 15 words.
Return JSON only: { insight: string }`;

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: CROWD_WISDOM_MODEL,
    max_tokens: 120,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0];
  const text = content?.type === "text" ? content.text : "";
  return parseInsightJson(text);
}

export function createCrowdWisdomService(depsInput?: Partial<ModuleDeps>) {
  const deps: ModuleDeps = {
    db: depsInput?.db ?? (prisma as unknown as DbLike),
    fetchInsiderFn: depsInput?.fetchInsiderFn ?? fetchInsiderTransactionsFromEodhd,
    writeInsightFn: depsInput?.writeInsightFn ?? writeContrarianInsightWithClaude,
  };

  async function getCrowdWisdom(symbolInput: string): Promise<CrowdWisdomResult> {
    const symbol = String(symbolInput ?? "").trim().toUpperCase();
    if (!symbol) throw new Error("Missing symbol");

    const retailSignals = await deps.db.signal.findMany({
      where: { ticker: symbol },
      orderBy: { created_at: "desc" },
      take: SIGNAL_SAMPLE_SIZE,
      select: { pattern_type: true, technical_data: true },
    });

    let bullish = 0;
    let bearish = 0;
    for (const row of retailSignals) {
      const direction = retailDirection(row);
      if (direction === "BULLISH") bullish += 1;
      if (direction === "BEARISH") bearish += 1;
    }
    const retailBase = bullish + bearish;
    const retailBullish = retailBase > 0 ? round2((bullish / retailBase) * 100) : 50;

    const insiderRows = await deps.fetchInsiderFn(symbol);
    const now = new Date();
    const cutoff = new Date(now.getTime() - INSIDER_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    let insiderBuy = 0;
    let insiderSell = 0;
    for (const row of insiderRows) {
      const txDate = parseDateFromInsiderRow(row);
      if (!txDate || txDate < cutoff) continue;
      const side = insiderSide(row);
      if (side === "BUY") insiderBuy += 1;
      if (side === "SELL") insiderSell += 1;
    }
    const insiderBase = insiderBuy + insiderSell;
    const insiderBuying = insiderBase > 0 ? round2((insiderBuy / insiderBase) * 100) : 50;

    const divergence = round2(insiderBuying - retailBullish);
    const signal: SignalValue =
      divergence >= SIGNAL_DIVERGENCE_THRESHOLD
        ? "CONTRARIAN_BUY"
        : divergence <= -SIGNAL_DIVERGENCE_THRESHOLD
          ? "CONTRARIAN_SELL"
          : "NEUTRAL";

    const insight = await deps.writeInsightFn(retailBullish, insiderBuying);

    return {
      symbol,
      retailBullish,
      insiderBuying,
      divergence,
      insight,
      signal,
    };
  }

  return { getCrowdWisdom };
}

let crowdWisdomServiceSingleton: ReturnType<typeof createCrowdWisdomService> | null = null;

function getCrowdWisdomService() {
  if (!crowdWisdomServiceSingleton) {
    crowdWisdomServiceSingleton = createCrowdWisdomService();
  }
  return crowdWisdomServiceSingleton;
}

export async function getCrowdWisdom(symbol: string): Promise<CrowdWisdomResult> {
  return getCrowdWisdomService().getCrowdWisdom(symbol);
}
