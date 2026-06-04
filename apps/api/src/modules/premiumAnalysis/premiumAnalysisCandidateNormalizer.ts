import type { SnapshotField, StockAIDataSnapshot } from "./dataSnapshot";

export type NormalizePremiumAnalysisCandidateResult = {
  candidate: unknown;
  changedFields: string[];
};

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

function toNonEmptyStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

function coerceNumericString(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(trimmed)) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
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

function tryNormalizeBusinessEngine(
  out: Record<string, unknown>,
  snapshot: StockAIDataSnapshot,
  changed: string[],
): void {
  if (isPlainObject(out.businessEngine)) return;
  if (!isPlainObject(out.company)) return;

  const company = out.company;
  const overview = pickString(
    company.overview,
    company.description,
    company.summary,
    company.businessOverview,
    company.name,
  );
  const sectorFromSnapshot = snapshotFieldString(snapshot.company.sector);
  const industryFromSnapshot = snapshotFieldString(snapshot.company.industry);
  const sectorIndustry =
    sectorFromSnapshot && industryFromSnapshot
      ? `${sectorFromSnapshot} / ${industryFromSnapshot}`
      : sectorFromSnapshot ?? industryFromSnapshot;

  const competitiveDynamics = pickString(
    company.competitiveDynamics,
    company.moat,
    company.competitivePosition,
    company.sector,
    company.industry,
    sectorIndustry,
  );

  let catalysts = toNonEmptyStringArray(company.catalysts);
  if (!catalysts.length) {
    const single = pickString(company.catalyst, company.keyDrivers);
    if (single) catalysts = [single];
  }

  let risks = toNonEmptyStringArray(company.risks ?? company.riskFactors);
  if (!risks.length) {
    const single = pickString(company.risk, company.primaryRisk);
    if (single) risks = [single];
  }

  if (!overview || !competitiveDynamics || catalysts.length < 1 || risks.length < 1) return;

  out.businessEngine = { overview, competitiveDynamics, catalysts, risks };
  changed.push("company->businessEngine");
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
  }

  if (isPlainObject(out.technicalSetup) && Array.isArray(out.technicalSetup.levels)) {
    out.technicalSetup.levels = normalizeMetricsArray(
      out.technicalSetup.levels,
      generatedAt,
      changed,
      "technicalSetup.levels",
    );
  }

  tryNormalizeBusinessEngine(out, snapshot, changed);

  return { candidate: out, changedFields: changed };
}
