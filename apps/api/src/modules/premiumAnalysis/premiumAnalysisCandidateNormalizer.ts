import type { SnapshotField, StockAIDataSnapshot } from "./dataSnapshot";

export type NormalizePremiumAnalysisCandidateResult = {
  candidate: unknown;
  changedFields: string[];
};

type RiskLevel = "low" | "medium" | "high";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function deepClonePlainObject<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function pickString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return undefined;
}

function snapshotFieldString(field: SnapshotField<string | null>): string | undefined {
  if (field.status === "ok" && typeof field.value === "string") {
    const trimmed = field.value.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

function snapshotFieldNumber(field: SnapshotField<number | null>): number | undefined {
  if (field.status === "ok" && typeof field.value === "number" && Number.isFinite(field.value)) {
    return field.value;
  }
  return undefined;
}

function toNonEmptyStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

function stringArrayFromAliases(
  source: Record<string, unknown>,
  keys: string[],
): string[] {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return [value.trim()];
    const array = toNonEmptyStringArray(value);
    if (array.length) return array;
  }
  return [];
}

function coerceNumericString(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(trimmed)) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeRiskLevel(value: unknown): RiskLevel {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "low" || normalized === "high") return normalized;
  return "medium";
}

function normalizeMetricsArray(
  metrics: unknown[],
  generatedAt: string | undefined,
  changed: string[],
  prefix: string,
): unknown[] {
  return metrics.map((metric, index) => {
    if (!isPlainObject(metric)) return metric;
    const next = { ...metric };
    if (typeof next.value === "string") {
      const coerced = coerceNumericString(next.value);
      if (coerced != null) {
        next.value = coerced;
        changed.push(`${prefix}[${index}].value`);
      }
    }
    if ((next.asOf == null || next.asOf === "") && generatedAt) {
      next.asOf = generatedAt;
      changed.push(`${prefix}[${index}].asOf`);
    }
    return next;
  });
}

function sectorIndustryFromSnapshot(snapshot: StockAIDataSnapshot): string | undefined {
  const sectorFromSnapshot = snapshotFieldString(snapshot.company.sector);
  const industryFromSnapshot = snapshotFieldString(snapshot.company.industry);
  if (sectorFromSnapshot && industryFromSnapshot) {
    return `${sectorFromSnapshot} / ${industryFromSnapshot}`;
  }
  return sectorFromSnapshot ?? industryFromSnapshot;
}

function buildTechnicalLevelsFromSnapshot(
  snapshot: StockAIDataSnapshot,
  generatedAt: string | undefined,
): Record<string, unknown>[] {
  const asOf = generatedAt ?? snapshot.computedAt;
  const levels: Record<string, unknown>[] = [];
  const support = snapshotFieldNumber(snapshot.technical.support60d);
  const resistance = snapshotFieldNumber(snapshot.technical.resistance60d);

  if (support != null) {
    levels.push({
      value: support,
      basis: "60-session support",
      source: "quote_history_60d",
      asOf,
    });
  }
  if (resistance != null) {
    levels.push({
      value: resistance,
      basis: "60-session resistance",
      source: "quote_history_60d",
      asOf,
    });
  }
  return levels;
}

function normalizeBusinessEngineFields(
  businessEngine: Record<string, unknown>,
  company: Record<string, unknown> | null,
  snapshot: StockAIDataSnapshot,
  changed: string[],
  prefix = "businessEngine",
): void {
  if (!pickString(businessEngine.overview)) {
    const overview = pickString(
      businessEngine.summary,
      businessEngine.description,
      businessEngine.businessOverview,
      businessEngine.businessModel,
      businessEngine.companySummary,
      company?.overview,
      company?.description,
      company?.summary,
      company?.businessOverview,
      company?.name,
    );
    if (overview) {
      businessEngine.overview = overview;
      changed.push(`${prefix}.overview`);
    }
  }

  if (!pickString(businessEngine.competitiveDynamics)) {
    const competitiveDynamics = pickString(
      businessEngine.competitiveDynamics,
      businessEngine.competitivePosition,
      businessEngine.competition,
      businessEngine.moat,
      businessEngine.marketPosition,
      businessEngine.industryDynamics,
      company?.competitiveDynamics,
      company?.competitivePosition,
      company?.moat,
      company?.sector,
      company?.industry,
      sectorIndustryFromSnapshot(snapshot),
    );
    if (competitiveDynamics) {
      businessEngine.competitiveDynamics = competitiveDynamics;
      changed.push(`${prefix}.competitiveDynamics`);
    }
  }

  const catalystKeys = ["catalysts", "keyCatalysts", "drivers", "growthDrivers", "positives"];
  const existingCatalysts = toNonEmptyStringArray(businessEngine.catalysts);
  if (!existingCatalysts.length) {
    let catalysts = stringArrayFromAliases(businessEngine, catalystKeys);
    if (!catalysts.length && company) catalysts = stringArrayFromAliases(company, catalystKeys);
    if (catalysts.length) {
      businessEngine.catalysts = catalysts;
      changed.push(`${prefix}.catalysts`);
    }
  } else {
    businessEngine.catalysts = existingCatalysts;
  }

  const riskKeys = ["risks", "keyRisks", "riskFactors", "negatives", "headwinds"];
  const existingRisks = toNonEmptyStringArray(businessEngine.risks);
  if (!existingRisks.length) {
    let risks = stringArrayFromAliases(businessEngine, riskKeys);
    if (!risks.length && company) risks = stringArrayFromAliases(company, riskKeys);
    if (risks.length) {
      businessEngine.risks = risks;
      changed.push(`${prefix}.risks`);
    }
  } else {
    businessEngine.risks = existingRisks;
  }
}

function tryNormalizeBusinessEngine(
  out: Record<string, unknown>,
  snapshot: StockAIDataSnapshot,
  changed: string[],
): void {
  const company = isPlainObject(out.company) ? out.company : null;

  if (isPlainObject(out.businessEngine)) {
    normalizeBusinessEngineFields(out.businessEngine, company, snapshot, changed);
    return;
  }

  if (!company) return;

  const overview = pickString(
    company.overview,
    company.description,
    company.summary,
    company.businessOverview,
    company.name,
  );
  const competitiveDynamics = pickString(
    company.competitiveDynamics,
    company.moat,
    company.competitivePosition,
    company.sector,
    company.industry,
    sectorIndustryFromSnapshot(snapshot),
  );

  let catalysts = stringArrayFromAliases(company, ["catalysts", "keyCatalysts", "drivers", "growthDrivers"]);
  if (!catalysts.length) {
    const single = pickString(company.catalyst, company.keyDrivers);
    if (single) catalysts = [single];
  }

  let risks = stringArrayFromAliases(company, ["risks", "keyRisks", "riskFactors", "negatives"]);
  if (!risks.length) {
    const single = pickString(company.risk, company.primaryRisk);
    if (single) risks = [single];
  }

  if (!overview || !competitiveDynamics || catalysts.length < 1 || risks.length < 1) return;

  out.businessEngine = { overview, competitiveDynamics, catalysts, risks };
  changed.push("company->businessEngine");
}

function normalizeTechnicalSetupSection(
  technicalSetup: Record<string, unknown>,
  snapshot: StockAIDataSnapshot,
  generatedAt: string | undefined,
  changed: string[],
): void {
  if (!pickString(technicalSetup.summary)) {
    const summary = pickString(
      technicalSetup.setup,
      technicalSetup.technicalSummary,
      technicalSetup.trendSummary,
      technicalSetup.description,
      snapshotFieldString(snapshot.technical.trendSummary),
    );
    if (summary) {
      technicalSetup.summary = summary;
      changed.push("technicalSetup.summary");
    }
  }

  if (!pickString(technicalSetup.trend)) {
    const trend = pickString(
      technicalSetup.trendLabel,
      technicalSetup.direction,
      technicalSetup.trendSummary,
      snapshotFieldString(snapshot.technical.trendSummary),
    );
    if (trend) {
      technicalSetup.trend = trend;
      changed.push("technicalSetup.trend");
    }
  }

  const aliasLevels = technicalSetup.supportResistance ??
    technicalSetup.supportResistanceLevels ??
    technicalSetup.keyLevels;
  if ((!Array.isArray(technicalSetup.levels) || technicalSetup.levels.length === 0) && Array.isArray(aliasLevels)) {
    technicalSetup.levels = normalizeMetricsArray(aliasLevels, generatedAt, changed, "technicalSetup.levels");
  }

  if (!Array.isArray(technicalSetup.levels) || technicalSetup.levels.length === 0) {
    const fromSnapshot = buildTechnicalLevelsFromSnapshot(snapshot, generatedAt);
    if (fromSnapshot.length > 0) {
      technicalSetup.levels = fromSnapshot;
      changed.push("technicalSetup.levels<-snapshot");
    }
  } else {
    technicalSetup.levels = normalizeMetricsArray(
      technicalSetup.levels,
      generatedAt,
      changed,
      "technicalSetup.levels",
    );
  }
}

function normalizeRiskMapSection(riskMap: Record<string, unknown>, changed: string[]): void {
  const items = Array.isArray(riskMap.items) ? riskMap.items : [];

  if (!pickString(riskMap.summary)) {
    const summary = pickString(riskMap.riskSummary, riskMap.overview, riskMap.description);
    if (summary) {
      riskMap.summary = summary;
      changed.push("riskMap.summary");
    } else if (items.length > 0) {
      riskMap.summary = "Risk map derived from model-provided risk items.";
      changed.push("riskMap.summary");
    }
  }

  riskMap.items = items.map((item, index) => {
    if (!isPlainObject(item)) return item;
    const next = { ...item };

    if (!pickString(next.id)) {
      next.id =
        pickString(next.key, next.slug, next.title, next.name, next.factor, next.risk, next.category) ??
        `risk_${index + 1}`;
      changed.push(`riskMap.items[${index}].id`);
    }
    if (!pickString(next.title)) {
      const title = pickString(next.name, next.risk, next.factor, next.category);
      if (title) {
        next.title = title;
        changed.push(`riskMap.items[${index}].title`);
      }
    }
    if (!pickString(next.description)) {
      const description = pickString(next.summary, next.detail, next.rationale, next.impact, next.title);
      if (description) {
        next.description = description;
        changed.push(`riskMap.items[${index}].description`);
      }
    }
    if (!pickString(next.category)) {
      next.category = pickString(next.type, next.bucket, next.theme) ?? "general";
      changed.push(`riskMap.items[${index}].category`);
    }

    const severity = normalizeRiskLevel(next.severity);
    if (next.severity !== severity) {
      next.severity = severity;
      changed.push(`riskMap.items[${index}].severity`);
    }
    const likelihood = normalizeRiskLevel(next.likelihood);
    if (next.likelihood !== likelihood) {
      next.likelihood = likelihood;
      changed.push(`riskMap.items[${index}].likelihood`);
    }

    return next;
  });
}

/**
 * Deterministic compatibility pass before PremiumAnalysisContract validation.
 */
export function normalizePremiumAnalysisCandidate(
  parsed: unknown,
  snapshot: StockAIDataSnapshot,
): NormalizePremiumAnalysisCandidateResult {
  if (!isPlainObject(parsed)) {
    return { candidate: parsed, changedFields: [] };
  }

  const out = deepClonePlainObject(parsed);
  const changed: string[] = [];
  const generatedAt = pickString(out.generatedAt);
  const decisionNoteText = isPlainObject(out.decisionNote)
    ? pickString(out.decisionNote.note)
    : pickString(out.decisionNote);

  if (!isPlainObject(out.technicalSetup) && isPlainObject(out.technicalContext)) {
    out.technicalSetup = deepClonePlainObject(out.technicalContext);
    changed.push("technicalContext->technicalSetup");
  }

  if (isPlainObject(out.dataFreshness)) {
    const dataFreshness = out.dataFreshness;
    if (!pickString(dataFreshness.computedAt) && generatedAt) {
      dataFreshness.computedAt = generatedAt;
      changed.push("dataFreshness.computedAt");
    }
    if (!pickString(dataFreshness.snapshotVersion)) {
      dataFreshness.snapshotVersion = snapshot.version;
      changed.push("dataFreshness.snapshotVersion");
    }
    if (Array.isArray(dataFreshness.sources)) {
      dataFreshness.sources = dataFreshness.sources.map((source, index) => {
        if (!isPlainObject(source)) return source;
        const next = { ...source };
        if (!pickString(next.id)) {
          next.id = pickString(next.key, next.name, next.label) ?? `source_${index + 1}`;
          changed.push(`dataFreshness.sources[${index}].id`);
        }
        return next;
      });
    }
  }

  if (isPlainObject(out.valuationContext)) {
    const valuationContext = out.valuationContext;
    if (!pickString(valuationContext.summary) && decisionNoteText) {
      valuationContext.summary = decisionNoteText;
      changed.push("valuationContext.summary");
    }
    if (Array.isArray(valuationContext.metrics)) {
      valuationContext.metrics = normalizeMetricsArray(
        valuationContext.metrics,
        generatedAt,
        changed,
        "valuationContext.metrics",
      );
    }
  }

  if (isPlainObject(out.scenarios)) {
    const scenarios = out.scenarios;
    if (scenarios.horizonMonths == null || scenarios.horizonMonths === "") {
      scenarios.horizonMonths = 12;
      changed.push("scenarios.horizonMonths");
    }
    if (Array.isArray(scenarios.scenarios)) {
      scenarios.scenarios = scenarios.scenarios.map((scenario, index) => {
        if (!isPlainObject(scenario)) return scenario;
        const next = { ...scenario };
        if (!pickString(next.narrative)) {
          const narrative =
            pickString(next.summary, next.thesis, next.description, next.rationale, next.title) ??
            "Scenario narrative not provided by model.";
          next.narrative = narrative;
          changed.push(`scenarios.scenarios[${index}].narrative`);
        }
        if (next.priceTarget === null) {
          delete next.priceTarget;
          changed.push(`scenarios.scenarios[${index}].priceTarget`);
        }
        return next;
      });
    }
  }

  if (isPlainObject(out.executiveVerdict)) {
    const executiveVerdict = out.executiveVerdict;
    if (!pickString(executiveVerdict.headline)) {
      const headline = pickString(executiveVerdict.title, executiveVerdict.summary, executiveVerdict.verdictSummary);
      if (headline) {
        executiveVerdict.headline = headline;
        changed.push("executiveVerdict.headline");
      }
    }
    if (!pickString(executiveVerdict.educationalNote)) {
      const educationalNote = pickString(
        executiveVerdict.note,
        executiveVerdict.disclaimer,
        decisionNoteText,
      );
      if (educationalNote) {
        executiveVerdict.educationalNote = educationalNote;
        changed.push("executiveVerdict.educationalNote");
      }
    }
    if (!pickString(executiveVerdict.summary)) {
      const summary = pickString(
        executiveVerdict.verdictSummary,
        executiveVerdict.description,
        executiveVerdict.rationale,
        executiveVerdict.note,
        decisionNoteText,
        executiveVerdict.educationalNote,
        executiveVerdict.headline,
      );
      if (summary) {
        executiveVerdict.summary = summary;
        changed.push("executiveVerdict.summary");
      }
    }
  }

  if (isPlainObject(out.technicalSetup)) {
    normalizeTechnicalSetupSection(out.technicalSetup, snapshot, generatedAt, changed);
  }

  if (isPlainObject(out.riskMap)) {
    normalizeRiskMapSection(out.riskMap, changed);
  }

  tryNormalizeBusinessEngine(out, snapshot, changed);

  return { candidate: out, changedFields: changed };
}
