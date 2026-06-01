import { z } from "zod";

export const FieldStatusSchema = z.enum(["ok", "missing", "stale", "not_wired", "requires_access"]);

export const DataFreshnessSchema = z.object({
  computedAt: z.string().datetime(),
  snapshotVersion: z.string().min(1),
  sources: z.array(
    z.object({
      id: z.string().min(1),
      asOf: z.string().datetime().nullable().optional(),
      status: FieldStatusSchema,
    }),
  ),
  coverage: z.array(z.string()),
  missingData: z.array(z.string()),
});

export const NumericClaimSchema = z.object({
  value: z.number().finite(),
  unit: z.string().optional(),
  basis: z.string().min(1),
  source: z.string().min(1),
  asOf: z.string().datetime().optional(),
});

export const VerdictLabelSchema = z.enum(["avoid", "watch", "hold", "constructive", "bullish"]);

export const ExecutiveVerdictSchema = z.object({
  label: VerdictLabelSchema,
  headline: z.string().min(1).max(240),
  summary: z.string().min(1).max(1200),
  confidence: z.number().min(0).max(100),
  horizonMonths: z.number().int().min(1).max(60),
  /** Educational framing - not a guarantee of returns. */
  educationalNote: z.string().min(1).max(500),
});

export const BusinessEngineSchema = z.object({
  overview: z.string().min(1).max(1500),
  competitiveDynamics: z.string().min(1).max(1000),
  catalysts: z.array(z.string().min(1)).min(1).max(8),
  risks: z.array(z.string().min(1)).min(1).max(8),
});

export const ValuationContextSchema = z.object({
  summary: z.string().min(1).max(1200),
  metrics: z.array(NumericClaimSchema).max(12),
  relativeToPeers: z.string().max(800).optional(),
  historicalContext: z.string().max(800).optional(),
});

export const TechnicalSetupSchema = z.object({
  summary: z.string().min(1).max(1000),
  trend: z.string().min(1).max(300),
  levels: z.array(NumericClaimSchema).max(8),
  momentumNotes: z.string().max(600).optional(),
});

export const ScenarioSchema = z.object({
  name: z.enum(["bull", "base", "bear"]),
  probabilityPct: z.number().min(0).max(100),
  narrative: z.string().min(1).max(800),
  drivers: z.array(z.string().min(1)).min(1).max(6),
  risks: z.array(z.string().min(1)).min(1).max(6),
  invalidation: z.string().min(1).max(400),
  priceTarget: NumericClaimSchema.optional(),
});

export const ScenarioSetSchema = z.object({
  horizonMonths: z.number().int().min(1).max(60),
  scenarios: z.array(ScenarioSchema).length(3),
}).superRefine((value, ctx) => {
  const required = new Set(["bull", "base", "bear"]);
  const seen = new Set<string>(value.scenarios.map((scenario) => scenario.name));
  if (seen.size !== 3 || [...required].some((name) => !seen.has(name))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["scenarios"],
      message: "Scenarios must include exactly one bull, one base, and one bear case.",
    });
  }
});

export const RiskMapItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(160),
  description: z.string().min(1).max(600),
  severity: z.enum(["low", "medium", "high"]),
  likelihood: z.enum(["low", "medium", "high"]),
  category: z.string().min(1).max(80),
});

export const RiskMapSchema = z.object({
  summary: z.string().min(1).max(800),
  items: z.array(RiskMapItemSchema).min(1).max(12),
});

export const HistoricalTwinSummarySchema = z.object({
  summary: z.string().min(1).max(1000),
  matchCount: z.number().int().min(0),
  avgOutcomePct: NumericClaimSchema.optional(),
  lesson: z.string().min(1).max(600),
});

export const PersonalFitSchema = z.object({
  summary: z.string().min(1).max(1000),
  alignmentScore: z.number().min(0).max(100),
  matches: z.array(z.string().min(1)).max(8),
  mismatches: z.array(z.string().min(1)).max(8),
  suggestedActions: z.array(z.string().min(1)).max(6),
});

export const ThesisInvalidatorSchema = z.object({
  trigger: z.string().min(1).max(300),
  impact: z.enum(["low", "medium", "high"]),
  monitor: z.string().min(1).max(300),
});

export const ThesisInvalidatorsSchema = z.object({
  summary: z.string().min(1).max(600),
  items: z.array(ThesisInvalidatorSchema).min(1).max(8),
});

export const DecisionNoteSchema = z.object({
  /** Educational synthesis - not direct buy/sell advice. */
  note: z.string().min(1).max(900),
  stance: z.enum(["avoid", "watch", "research", "constructive", "cautious"]),
  keyQuestions: z.array(z.string().min(1)).min(1).max(6),
});

export const PremiumAnalysisContractSchema = z.object({
  version: z.literal("1.0"),
  symbol: z.string().min(1),
  generatedAt: z.string().datetime(),
  dataFreshness: DataFreshnessSchema,
  executiveVerdict: ExecutiveVerdictSchema,
  businessEngine: BusinessEngineSchema,
  valuationContext: ValuationContextSchema,
  technicalSetup: TechnicalSetupSchema,
  scenarios: ScenarioSetSchema,
  riskMap: RiskMapSchema,
  historicalTwins: HistoricalTwinSummarySchema,
  personalFit: PersonalFitSchema.optional(),
  thesisInvalidators: ThesisInvalidatorsSchema,
  decisionNote: DecisionNoteSchema,
  dataCoverage: z.array(z.string()),
  missingData: z.array(z.string()),
});

export type PremiumAnalysisContract = z.infer<typeof PremiumAnalysisContractSchema>;
export type ExecutiveVerdict = z.infer<typeof ExecutiveVerdictSchema>;
export type ScenarioSet = z.infer<typeof ScenarioSetSchema>;

export type ValidatePremiumAnalysisResult =
  | { success: true; data: PremiumAnalysisContract }
  | { success: false; error: z.ZodError };

export function validatePremiumAnalysisContract(payload: unknown): ValidatePremiumAnalysisResult {
  const parsed = PremiumAnalysisContractSchema.safeParse(payload);
  if (parsed.success) return { success: true, data: parsed.data };
  return { success: false, error: parsed.error };
}

/** Minimal valid sample for tests and documentation. */
export function buildSamplePremiumAnalysisContract(symbol = "AAPL.US"): PremiumAnalysisContract {
  const now = new Date().toISOString();
  const numeric = (value: number, basis: string, source: string): z.infer<typeof NumericClaimSchema> => ({
    value,
    basis,
    source,
    asOf: now,
  });

  return {
    version: "1.0",
    symbol,
    generatedAt: now,
    dataFreshness: {
      computedAt: now,
      snapshotVersion: "1.0",
      sources: [{ id: "quotes", asOf: now, status: "ok" }],
      coverage: ["quote.latest", "fundamentals.peTtm"],
      missingData: [],
    },
    executiveVerdict: {
      label: "constructive",
      headline: "Quality compounder with balanced risk/reward",
      summary:
        "Educational view only: fundamentals and trend support a constructive stance with monitoring of valuation.",
      confidence: 72,
      horizonMonths: 12,
      educationalNote: "Not investment advice. Outcomes depend on execution, macro, and multiple expansion.",
    },
    businessEngine: {
      overview: "Large-cap platform business with diversified revenue.",
      competitiveDynamics: "Scale and ecosystem create switching costs.",
      catalysts: ["Product cycle refresh", "Capital return policy"],
      risks: ["Regulatory scrutiny", "Multiple compression if growth slows"],
    },
    valuationContext: {
      summary: "Valuation sits near long-run averages for quality peers.",
      metrics: [numeric(28.5, "P/E vs TTM EPS", "fundamentals_eps_ttm")],
      relativeToPeers: "In line with sector median on earnings yield.",
    },
    technicalSetup: {
      summary: "Price holds above recent support with neutral momentum.",
      trend: "Sideways to modest uptrend over 20 sessions.",
      levels: [numeric(180, "60-session support", "quote_history_60d")],
    },
    scenarios: {
      horizonMonths: 12,
      scenarios: [
        {
          name: "bull",
          probabilityPct: 30,
          narrative: "Earnings beat and multiple expansion.",
          drivers: ["Margin expansion"],
          risks: ["Macro shock"],
          invalidation: "Close below support on volume.",
          priceTarget: numeric(220, "12m bull case", "scenario_model"),
        },
        {
          name: "base",
          probabilityPct: 50,
          narrative: "Steady compounding in line with history.",
          drivers: ["Stable demand"],
          risks: ["Competition"],
          invalidation: "Two consecutive revenue misses.",
        },
        {
          name: "bear",
          probabilityPct: 20,
          narrative: "Growth deceleration and de-rating.",
          drivers: ["Higher rates"],
          risks: ["Guidance cut"],
          invalidation: "RSI breakdown with widening credit spreads.",
          priceTarget: numeric(150, "12m bear case", "scenario_model"),
        },
      ],
    },
    riskMap: {
      summary: "Key risks cluster around valuation and execution.",
      items: [
        {
          id: "val-1",
          title: "Multiple risk",
          description: "Premium multiple leaves less room for misses.",
          severity: "medium",
          likelihood: "medium",
          category: "valuation",
        },
      ],
    },
    historicalTwins: {
      summary: "Historical analogs show outcome dispersion tied to execution.",
      matchCount: 3,
      lesson: "Patience around entries improved risk-adjusted outcomes in similar setups.",
    },
    thesisInvalidators: {
      summary: "Monitor triggers that would invalidate a constructive thesis.",
      items: [
        {
          trigger: "Revenue growth below sector for two quarters",
          impact: "high",
          monitor: "Quarterly filings and guidance",
        },
      ],
    },
    decisionNote: {
      note: "Educational synthesis: constructive bias requires ongoing validation of growth and margins.",
      stance: "research",
      keyQuestions: ["Is valuation justified by forward growth?", "What breaks the thesis?"],
    },
    dataCoverage: ["quote.latest", "fundamentals.peTtm"],
    missingData: [],
  };
}
