import type { TFunction } from "i18next";
import type { NewsRow } from "../services/api";

type SectorKey =
  | "communication"
  | "technology"
  | "financials"
  | "healthcare"
  | "energy"
  | "consumer"
  | "industrial"
  | "general";

function classifySector(sector?: string | null, industry?: string | null): SectorKey {
  const haystack = `${sector ?? ""} ${industry ?? ""}`.toLowerCase();
  if (/telecom|communication|media|entertainment|broadcast|wireless|cyfrowy|polsat|streaming/.test(haystack)) {
    return "communication";
  }
  if (/tech|software|semiconductor|internet|cloud|ai\b/.test(haystack)) return "technology";
  if (/bank|financial|insurance|capital market/.test(haystack)) return "financials";
  if (/health|pharma|biotech|medical/.test(haystack)) return "healthcare";
  if (/energy|oil|gas|utility|mining/.test(haystack)) return "energy";
  if (/retail|consumer|food|beverage/.test(haystack)) return "consumer";
  if (/industrial|manufacturing|aerospace|defense|transport/.test(haystack)) return "industrial";
  return "general";
}

const TITLE_KEYS: Record<SectorKey, readonly [string, string, string]> = {
  communication: [
    "signals.fallback.communication.0",
    "signals.fallback.communication.1",
    "signals.fallback.communication.2",
  ],
  technology: ["signals.fallback.technology.0", "signals.fallback.technology.1", "signals.fallback.technology.2"],
  financials: ["signals.fallback.financials.0", "signals.fallback.financials.1", "signals.fallback.financials.2"],
  healthcare: ["signals.fallback.healthcare.0", "signals.fallback.healthcare.1", "signals.fallback.healthcare.2"],
  energy: ["signals.fallback.energy.0", "signals.fallback.energy.1", "signals.fallback.energy.2"],
  consumer: ["signals.fallback.consumer.0", "signals.fallback.consumer.1", "signals.fallback.consumer.2"],
  industrial: ["signals.fallback.industrial.0", "signals.fallback.industrial.1", "signals.fallback.industrial.2"],
  general: ["signals.fallback.general.0", "signals.fallback.general.1", "signals.fallback.general.2"],
};

const TITLE_DEFAULTS: Record<SectorKey, readonly [string, string, string]> = {
  communication: [
    "Telecom operators report stable ARPU growth in bundled service segments",
    "Video ad markets are growing double digits; linear and OTT broadcasters compete for inventory",
    "Sports broadcast rights remain a key cost driver for media groups",
  ],
  technology: [
    "Software companies report rising enterprise orders in hybrid cloud",
    "EU AI regulation affects rollout timelines for technology products",
    "Tech sector: investors reassess margins after the quarterly earnings season",
  ],
  financials: [
    "Central banks signal a more cautious pace of rate cuts",
    "Banking sector: net interest margin under pressure from deposit competition",
    "Mortgage lending: demand stabilizes after an earlier correction",
  ],
  healthcare: [
    "Pharma producers monitor reimbursement lists and drug launch schedules",
    "Med-tech sector reports rising orders for diagnostic equipment",
    "Investors evaluate R&D pipelines amid pricing pressure in the EU",
  ],
  energy: [
    "Natural gas prices stabilize after earlier seasonal volatility",
    "Energy companies update renewable and storage investment plans",
    "Coal markets show moderate industrial demand in the CEE region",
  ],
  consumer: [
    "Retailers report improved same-store sales in non-food segments",
    "Consumers react to promotions; retail margins remain under watch",
    "FMCG: producers pass part of raw-material costs through to end prices",
  ],
  industrial: [
    "Eurozone manufacturing PMI points to a cautious rebound in B2B orders",
    "Industrial producers face logistics costs and component lead times",
    "Capital goods order backlog remains elevated",
  ],
  general: [
    "Broad index consolidates after earlier macro volatility",
    "Institutional investors increase allocation to stable dividend names",
    "Analysts update valuation models after macro data releases",
  ],
};

export function buildSignalsFallbackNews(
  params: {
    symbol: string;
    sector?: string | null;
    industry?: string | null;
  },
  t: TFunction,
): NewsRow[] {
  const sym = params.symbol.toUpperCase();
  const sectorKey = classifySector(params.sector, params.industry);
  const keys = TITLE_KEYS[sectorKey];
  const defaults = TITLE_DEFAULTS[sectorKey];
  const now = Date.now();

  return keys.map((key, index) => ({
    id: `fallback-${sym}-${index + 1}`,
    symbol: sym,
    timestamp: new Date(now - (index + 1) * 6 * 60 * 60 * 1000).toISOString(),
    title: t(key, { defaultValue: defaults[index] }),
    url: "#",
    source: "StockAI Feed",
    sentiment: null,
  }));
}
