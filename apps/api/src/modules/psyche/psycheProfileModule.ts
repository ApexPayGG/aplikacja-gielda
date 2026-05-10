import Anthropic from "@anthropic-ai/sdk";
import process from "node:process";
import { prisma } from "../../db/index";

const MODEL = "claude-sonnet-4-20250514";

const ALLOWED_BIASES = new Set(["FOMO", "REVENGE", "OVERTRADING", "EARLY_EXIT", "OVERLEVERAGING"]);

export type TraderProfileDto = {
  id: string;
  userId: string;
  topBiases: string[];
  tradingStyle: string | null;
  goodConditions: string | null;
  badConditions: string | null;
  growthScore: number;
  updatedAt: string;
};

export type DecisionLogDto = {
  id: string;
  userId: string;
  tradeId: string | null;
  symbol: string;
  action: string;
  mood: string | null;
  reasoning: string | null;
  planCompliance: boolean | null;
  outcome: number | null;
  createdAt: string;
};

export type TradingRuleDto = {
  id: string;
  userId: string;
  rule: string;
  active: boolean;
  breaches: number;
  createdAt: string;
};

function requireApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error("ANTHROPIC_API_KEY is not configured");
  return key;
}

function extractJsonObject(raw: string): Record<string, unknown> {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("No JSON object in model response");
  const parsed: unknown = JSON.parse(m[0]);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Model JSON must be an object");
  }
  return parsed as Record<string, unknown>;
}

function asStringArray(v: unknown, max = 8): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => String(x ?? "").trim())
    .filter(Boolean)
    .slice(0, max);
}

function normalizeBiases(raw: unknown): string[] {
  const arr = asStringArray(raw, 5)
    .map((s) => s.toUpperCase().replace(/\s+/g, "_"))
    .filter((s) => ALLOWED_BIASES.has(s));
  return Array.from(new Set(arr)).slice(0, 3);
}

function clampInt(n: unknown, min: number, max: number): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, v));
}

function truncateWords(text: unknown, maxWords: number): string | null {
  if (text == null) return null;
  const s = String(text).trim();
  if (!s) return null;
  const words = s.split(/\s+/).filter(Boolean);
  return words.slice(0, maxWords).join(" ") || null;
}

function serializeProfile(row: {
  id: string;
  userId: string;
  topBiases: string[];
  tradingStyle: string | null;
  goodConditions: string | null;
  badConditions: string | null;
  growthScore: number;
  updatedAt: Date;
}): TraderProfileDto {
  return {
    id: row.id,
    userId: row.userId,
    topBiases: row.topBiases ?? [],
    tradingStyle: row.tradingStyle,
    goodConditions: row.goodConditions,
    badConditions: row.badConditions,
    growthScore: row.growthScore,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeDecisionLog(row: {
  id: string;
  userId: string;
  tradeId: string | null;
  symbol: string;
  action: string;
  mood: string | null;
  reasoning: string | null;
  planCompliance: boolean | null;
  outcome: number | null;
  createdAt: Date;
}): DecisionLogDto {
  return {
    id: row.id,
    userId: row.userId,
    tradeId: row.tradeId,
    symbol: row.symbol,
    action: row.action,
    mood: row.mood,
    reasoning: row.reasoning,
    planCompliance: row.planCompliance,
    outcome: row.outcome,
    createdAt: row.createdAt.toISOString(),
  };
}

function serializeTradingRule(row: {
  id: string;
  userId: string;
  rule: string;
  active: boolean;
  breaches: number;
  createdAt: Date;
}): TradingRuleDto {
  return {
    id: row.id,
    userId: row.userId,
    rule: row.rule,
    active: row.active,
    breaches: row.breaches,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getTraderProfile(userId: string): Promise<{ profile: TraderProfileDto | null; hasProfile: boolean }> {
  const row = await prisma.traderProfile.findUnique({ where: { userId } });
  if (!row) return { profile: null, hasProfile: false };
  return { profile: serializeProfile(row), hasProfile: true };
}

export async function updateTraderProfile(userId: string): Promise<TraderProfileDto> {
  const [decisions, mistakes, stress] = await Promise.all([
    prisma.decisionLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.mistakeLibrary.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.emotionalEvent.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  const decisionsPayload = decisions.map((d) => ({
    at: d.createdAt.toISOString(),
    symbol: d.symbol,
    action: d.action,
    mood: d.mood,
    planOk: d.planCompliance,
    outcome: d.outcome,
    note: d.reasoning?.slice(0, 200) ?? null,
  }));

  const mistakesPayload = mistakes.map((m) => ({
    at: m.createdAt.toISOString(),
    symbol: m.symbol,
    type: m.type,
    pnl: m.pnl,
    explanation: m.explanation,
  }));

  const stressPayload = stress.map((e) => ({
    at: e.createdAt.toISOString(),
    stressDetected: e.stressDetected,
    clickRate: e.clickRate,
    tradeFrequency: e.tradeFrequency,
    avgDecisionTime: e.avgDecisionTime,
    suggestion: e.suggestion,
  }));

  const client = new Anthropic({ apiKey: requireApiKey() });
  const prompt = `Analyze this trader's behavioral patterns.
Decisions: ${JSON.stringify(decisionsPayload)}
Mistakes: ${JSON.stringify(mistakesPayload)}
Stress events: ${JSON.stringify(stressPayload)}

Return JSON only with this exact shape:
{
  "topBiases": string[] (max 3, one word each from: FOMO, REVENGE, OVERTRADING, EARLY_EXIT, OVERLEVERAGING),
  "tradingStyle": string (max 8 words),
  "goodConditions": string (max 10 words),
  "badConditions": string (max 10 words),
  "growthScore": number (0-100, based on improvement trend vs noise)
}`;

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 600,
    temperature: 0.2,
    messages: [{ role: "user", content: prompt }],
  });
  const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("\n").trim();
  const json = extractJsonObject(text);

  const topBiases = normalizeBiases(json.topBiases);
  const tradingStyle = truncateWords(json.tradingStyle, 8);
  const goodConditions = truncateWords(json.goodConditions, 10);
  const badConditions = truncateWords(json.badConditions, 10);
  const growthScore = clampInt(json.growthScore, 0, 100);

  const row = await prisma.traderProfile.upsert({
    where: { userId },
    create: {
      userId,
      topBiases,
      tradingStyle,
      goodConditions,
      badConditions,
      growthScore,
    },
    update: {
      topBiases,
      tradingStyle,
      goodConditions,
      badConditions,
      growthScore,
    },
  });

  return serializeProfile(row);
}

export type RuleBreachResult = { ruleId: string; rule: string };

export async function checkRuleBreaches(userId: string, context: string): Promise<RuleBreachResult[]> {
  const trimmed = context.trim();
  if (!trimmed) return [];

  const rules = await prisma.tradingRule.findMany({
    where: { userId, active: true },
    orderBy: { createdAt: "asc" },
  });
  if (rules.length === 0) return [];

  const client = new Anthropic({ apiKey: requireApiKey() });
  const ruleList = rules.map((r) => ({ id: r.id, text: r.rule }));
  const prompt = `User rules (id + text): ${JSON.stringify(ruleList)}
Current action / context: ${trimmed.slice(0, 800)}

Which rules are clearly being broken or violated by this context? Be conservative; if unclear, return none.
Return JSON only: { "breachedRuleIds": string[] } using the rule "id" values from the list above.`;

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    temperature: 0.1,
    messages: [{ role: "user", content: prompt }],
  });
  const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("\n").trim();
  let json: Record<string, unknown>;
  try {
    json = extractJsonObject(text);
  } catch {
    return [];
  }

  const ids = asStringArray(json.breachedRuleIds ?? json.breachedRules, 20);
  const idSet = new Set(rules.map((r) => r.id));
  const breached: RuleBreachResult[] = [];
  const seen = new Set<string>();

  for (const id of [...new Set(ids)]) {
    if (!idSet.has(id) || seen.has(id)) continue;
    seen.add(id);
    const rule = rules.find((r) => r.id === id);
    if (!rule) continue;
    await prisma.$transaction([
      prisma.ruleBreach.create({
        data: {
          userId,
          ruleId: id,
          context: trimmed.slice(0, 2000),
        },
      }),
      prisma.tradingRule.update({
        where: { id },
        data: { breaches: { increment: 1 } },
      }),
    ]);
    breached.push({ ruleId: id, rule: rule.rule });
  }

  return breached;
}

export async function listTradingRules(userId: string): Promise<TradingRuleDto[]> {
  const rows = await prisma.tradingRule.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(serializeTradingRule);
}

export async function createTradingRule(userId: string, rule: string): Promise<TradingRuleDto> {
  const text = rule.trim();
  if (!text) throw new Error("rule is required");
  if (text.length > 500) throw new Error("rule too long");
  const row = await prisma.tradingRule.create({
    data: { userId, rule: text, active: true },
  });
  return serializeTradingRule(row);
}

export async function deleteTradingRule(userId: string, ruleId: string): Promise<boolean> {
  const existing = await prisma.tradingRule.findFirst({
    where: { id: ruleId, userId },
  });
  if (!existing) return false;
  await prisma.ruleBreach.deleteMany({ where: { ruleId } });
  await prisma.tradingRule.delete({ where: { id: ruleId } });
  return true;
}

export async function createDecisionLog(input: {
  userId: string;
  symbol: string;
  action: string;
  mood?: string | null;
  reasoning?: string | null;
  tradeId?: string | null;
  planCompliance?: boolean | null;
  outcome?: number | null;
}): Promise<DecisionLogDto> {
  const symbol = input.symbol.trim().toUpperCase();
  if (!symbol) throw new Error("symbol is required");
  const action = input.action.trim();
  if (!action) throw new Error("action is required");

  const row = await prisma.decisionLog.create({
    data: {
      userId: input.userId,
      tradeId: input.tradeId ?? null,
      symbol,
      action,
      mood: input.mood?.trim() || null,
      reasoning: input.reasoning?.trim() || null,
      planCompliance: input.planCompliance ?? null,
      outcome: input.outcome ?? null,
    },
  });

  const ctx = `${action} ${symbol}${input.reasoning ? ` — ${input.reasoning}` : ""}${input.mood ? ` (mood: ${input.mood})` : ""}`;
  try {
    await checkRuleBreaches(input.userId, ctx);
  } catch {
    /* rule check is best-effort */
  }

  return serializeDecisionLog(row);
}

export async function listDecisionLogs(userId: string, take = 50): Promise<DecisionLogDto[]> {
  const rows = await prisma.decisionLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: Math.min(100, Math.max(1, take)),
  });
  return rows.map(serializeDecisionLog);
}

export async function seedDefaultTradingRules(userId: string): Promise<void> {
  const defaults = [
    "Max 2 transakcje dziennie",
    "Nie handluj w piątek po 14:00",
    "Stop loss zawsze przed wejściem",
  ];
  const existing = await prisma.tradingRule.count({ where: { userId } });
  if (existing > 0) return;
  await prisma.tradingRule.createMany({
    data: defaults.map((rule) => ({ userId, rule, active: true })),
    skipDuplicates: false,
  });
}
