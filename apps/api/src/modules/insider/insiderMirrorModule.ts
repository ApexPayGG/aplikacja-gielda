import Anthropic from "@anthropic-ai/sdk";
import process from "node:process";

const INSIDER_MIRROR_MODEL = "claude-sonnet-4-20250514";
const WINDOW_DAYS = 30;
const MIN_VALUE_USD = 50_000;
const MAX_TRANSACTIONS_IN_RESPONSE = 50;
const DEFAULT_INSIGHT = "No high-conviction insider signal detected in the last 30 days.";

type InsiderApiRow = Record<string, unknown>;

export type InsiderAction = "BUY" | "SELL";

export type InsiderSentiment = "BUY" | "SELL" | "NEUTRAL";

export type InsiderTransaction = {
  name: string;
  role: string;
  action: InsiderAction;
  value: number;
  date: string;
};

export type InsiderMirrorResult = {
  symbol: string;
  transactions: InsiderTransaction[];
  netSentiment: InsiderSentiment;
  insight: string;
};

type ModuleDeps = {
  fetchInsiderFn: (symbol: string) => Promise<InsiderApiRow[]>;
  writeInsightFn: (input: {
    symbol: string;
    buyCount: number;
    sellCount: number;
    biggest: InsiderTransaction | null;
  }) => Promise<string>;
};

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const asNumber = Number(value);
  return Number.isFinite(asNumber) ? asNumber : null;
}

function toCleanString(value: unknown): string {
  return String(value ?? "").trim();
}

function parseInsiderDate(row: InsiderApiRow): Date | null {
  const raw =
    row.transactionDate ??
    row.transaction_date ??
    row.date ??
    row.filingDate ??
    row.filing_date ??
    row.reportDate ??
    row.report_date ??
    row.filed_at;
  if (!raw) return null;
  const d = new Date(String(raw));
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseInsiderAction(row: InsiderApiRow): InsiderAction | null {
  const acquiredDisposed = toCleanString(
    row.transactionAcquiredDisposedCode ?? row.transaction_acquired_disposed_code,
  ).toUpperCase();
  if (acquiredDisposed === "A") return "BUY";
  if (acquiredDisposed === "D") return "SELL";

  const rawType =
    row.transactionCode ??
    row.transaction_code ??
    row.transactionType ??
    row.transaction_type ??
    row.type ??
    row.action ??
    row.code;
  const text = toCleanString(rawType).toLowerCase();
  if (!text) return null;

  if (
    text === "p" ||
    text === "b" ||
    text === "a" ||
    text.includes("buy") ||
    text.includes("purchase") ||
    text.includes("acquir")
  ) {
    return "BUY";
  }

  if (
    text === "s" ||
    text === "d" ||
    text.includes("sell") ||
    text.includes("sale") ||
    text.includes("dispos")
  ) {
    return "SELL";
  }

  return null;
}

function parseInsiderValue(row: InsiderApiRow): number | null {
  const directValue = toNumber(
    row.transactionValue ??
      row.transaction_value ??
      row.value ??
      row.totalValue ??
      row.total_value,
  );
  if (directValue !== null && directValue > 0) return directValue;

  const amount = toNumber(
    row.transactionAmount ??
      row.transaction_amount ??
      row.shares ??
      row.transactionShares ??
      row.transaction_shares ??
      row.quantity,
  );
  const price = toNumber(
    row.transactionPrice ??
      row.transaction_price ??
      row.price ??
      row.unitPrice ??
      row.unit_price,
  );
  if (amount !== null && price !== null) {
    return Math.abs(amount) * Math.abs(price);
  }
  return null;
}

function parseInsiderName(row: InsiderApiRow): string {
  return (
    toCleanString(
      row.ownerName ??
        row.owner_name ??
        row.insiderName ??
        row.insider_name ??
        row.reportingName ??
        row.reporting_name ??
        row.name,
    ) || "Unknown"
  );
}

function parseInsiderRole(row: InsiderApiRow): string {
  return (
    toCleanString(
      row.ownerRelationship ??
        row.owner_relationship ??
        row.officerTitle ??
        row.officer_title ??
        row.title ??
        row.position ??
        row.relationship ??
        row.role,
    ) || "Insider"
  );
}

function parseInsightJson(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return DEFAULT_INSIGHT;

  const match = trimmed.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]) as { insight?: unknown };
      const insight = String(parsed.insight ?? "")
        .trim()
        .replace(/\s+/g, " ");
      if (insight) return capWords(insight, 15);
    } catch {
      // fall through to plain-text handling
    }
  }

  const cleaned = trimmed.replace(/\s+/g, " ").slice(0, 240);
  return capWords(cleaned, 15) || DEFAULT_INSIGHT;
}

function capWords(text: string, maxWords: number): string {
  const words = text.split(" ").filter((w) => w.length > 0);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(" ");
}

function formatCurrencyShort(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
}

async function fetchInsiderByCode(code: string, token: string): Promise<InsiderApiRow[] | null> {
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
    throw new Error(
      `EODHD insider-transactions HTTP ${response.status}: ${bodyText.slice(0, 280)}`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    throw new Error(`EODHD insider-transactions invalid JSON: ${bodyText.slice(0, 200)}`);
  }
  if (!Array.isArray(parsed)) return [];
  return parsed as InsiderApiRow[];
}

async function fetchInsiderTransactionsFromEodhd(symbol: string): Promise<InsiderApiRow[]> {
  const token = process.env.EODHD_API_KEY?.trim();
  if (!token) {
    throw new Error("EODHD_API_KEY is not set. Insider Mirror requires insider data from EODHD.");
  }

  const upper = symbol.trim().toUpperCase();
  if (upper.includes(".")) {
    return (await fetchInsiderByCode(upper, token)) ?? [];
  }

  const usFirst = await fetchInsiderByCode(upper, token);
  if (usFirst !== null && usFirst.length > 0) return usFirst;

  const warFallback = await fetchInsiderByCode(`${upper}.WAR`, token);
  if (warFallback !== null) return warFallback;

  return usFirst ?? [];
}

async function writeInsiderInsightWithClaude(input: {
  symbol: string;
  buyCount: number;
  sellCount: number;
  biggest: InsiderTransaction | null;
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set. Insider Mirror insight requires Claude.");
  }

  const biggestLine = input.biggest
    ? `${input.biggest.name} ${input.biggest.action} $${formatCurrencyShort(input.biggest.value)}`
    : "no qualifying transaction";

  const prompt = `Insiders at ${input.symbol}: ${input.buyCount} buys, ${input.sellCount} sells last 30d.
Biggest transaction: ${biggestLine}.
Write 1 actionable insight, max 15 words.
Return JSON only: { "insight": string }`;

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: INSIDER_MIRROR_MODEL,
    max_tokens: 140,
    temperature: 0,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0];
  const text = content?.type === "text" ? content.text : "";
  return parseInsightJson(text);
}

export function createInsiderMirrorService(depsInput?: Partial<ModuleDeps>) {
  const deps: ModuleDeps = {
    fetchInsiderFn: depsInput?.fetchInsiderFn ?? fetchInsiderTransactionsFromEodhd,
    writeInsightFn: depsInput?.writeInsightFn ?? writeInsiderInsightWithClaude,
  };

  async function getInsiderMirror(symbolInput: string): Promise<InsiderMirrorResult> {
    const symbol = String(symbolInput ?? "").trim().toUpperCase();
    if (!symbol) throw new Error("Missing symbol");

    const rows = await deps.fetchInsiderFn(symbol);
    const now = Date.now();
    const cutoff = now - WINDOW_DAYS * 24 * 60 * 60 * 1000;

    const filtered: InsiderTransaction[] = [];
    for (const row of rows) {
      const txDate = parseInsiderDate(row);
      if (!txDate || txDate.getTime() < cutoff || txDate.getTime() > now) continue;
      const action = parseInsiderAction(row);
      if (action === null) continue;
      const value = parseInsiderValue(row);
      if (value === null || value <= MIN_VALUE_USD) continue;

      filtered.push({
        name: parseInsiderName(row),
        role: parseInsiderRole(row),
        action,
        value: Number(value.toFixed(2)),
        date: txDate.toISOString().slice(0, 10),
      });
    }

    filtered.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return b.value - a.value;
    });

    const transactions = filtered.slice(0, MAX_TRANSACTIONS_IN_RESPONSE);
    const buyCount = filtered.filter((t) => t.action === "BUY").length;
    const sellCount = filtered.filter((t) => t.action === "SELL").length;
    const netSentiment: InsiderSentiment =
      buyCount > sellCount ? "BUY" : sellCount > buyCount ? "SELL" : "NEUTRAL";

    const biggest = filtered.reduce<InsiderTransaction | null>((best, current) => {
      if (!best) return current;
      return current.value > best.value ? current : best;
    }, null);

    let insight = DEFAULT_INSIGHT;
    if (filtered.length > 0) {
      try {
        insight = await deps.writeInsightFn({ symbol, buyCount, sellCount, biggest });
      } catch (error) {
        console.error("[insider-mirror] insight generation failed", error);
        insight = DEFAULT_INSIGHT;
      }
    }

    return { symbol, transactions, netSentiment, insight };
  }

  return { getInsiderMirror };
}

let insiderMirrorServiceSingleton: ReturnType<typeof createInsiderMirrorService> | null = null;

function getInsiderMirrorService() {
  if (!insiderMirrorServiceSingleton) {
    insiderMirrorServiceSingleton = createInsiderMirrorService();
  }
  return insiderMirrorServiceSingleton;
}

export async function getInsiderMirror(symbol: string): Promise<InsiderMirrorResult> {
  return getInsiderMirrorService().getInsiderMirror(symbol);
}
