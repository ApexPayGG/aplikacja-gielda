import { useCallback, useMemo, useState } from "react";

export const SIGNAL_SETUP_TYPES = ["Breakout", "Support Bounce", "Volume Spike", "Oversold", "Momentum", "Earnings"] as const;
export const SIGNAL_EXCHANGES = ["GPW", "US", "DAX", "LSE", "KO", "HK"] as const;
export const SIGNAL_TIMEFRAMES = ["ALL", "TODAY", "THIS_WEEK", "THIS_MONTH"] as const;
export const SIGNAL_SORT_OPTIONS = ["SCORE_DESC", "SCORE_ASC", "NEWEST", "OLDEST"] as const;

export type SignalSetupType = (typeof SIGNAL_SETUP_TYPES)[number];
export type SignalExchange = (typeof SIGNAL_EXCHANGES)[number];
export type SignalsTimeframe = (typeof SIGNAL_TIMEFRAMES)[number];
export type SignalSortOption = (typeof SIGNAL_SORT_OPTIONS)[number];

export type SignalFilterItem = {
  id: string;
  setupType: string;
  riskScore: number;
  exchange?: string | null;
  createdAt?: string | null;
};

export type SignalsFilterState = {
  selectedSetupTypes: SignalSetupType[];
  riskScoreMin: number;
  selectedExchanges: SignalExchange[];
  timeframe: SignalsTimeframe;
  sortBy: SignalSortOption;
};

const DEFAULT_FILTERS: SignalsFilterState = {
  selectedSetupTypes: [],
  riskScoreMin: 0,
  selectedExchanges: [],
  timeframe: "ALL",
  sortBy: "SCORE_DESC",
};

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function normalizeSignalSetupType(value: string): SignalSetupType {
  const raw = value.trim().toLowerCase();
  if (raw.includes("breakout")) return "Breakout";
  if (raw.includes("support") || raw.includes("bounce")) return "Support Bounce";
  if (raw.includes("volume")) return "Volume Spike";
  if (raw.includes("oversold") || raw.includes("rsi")) return "Oversold";
  if (raw.includes("earning")) return "Earnings";
  return "Momentum";
}

export function normalizeSignalExchange(value: string | null | undefined): SignalExchange | null {
  const exchange = String(value ?? "")
    .trim()
    .toUpperCase();
  if (!exchange) return null;

  if (["WA", "WAR", "WSE", "GPW", "PL"].some((code) => exchange.includes(code))) return "GPW";
  if (["US", "NYSE", "NASDAQ", "AMEX", "ARCA", "BATS"].some((code) => exchange.includes(code))) return "US";
  if (["DE", "XETRA", "FRA", "GER", "DAX"].some((code) => exchange.includes(code))) return "DAX";
  if (["LSE", "LON", "UK", "GB"].some((code) => exchange.includes(code))) return "LSE";
  if (["KO", "KOSDAQ", "KOSPI", "KRX"].some((code) => exchange.includes(code))) return "KO";
  if (["HK", "HKEX", "HKG"].some((code) => exchange.includes(code))) return "HK";
  return null;
}

function getTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isInTimeframe(value: string | null | undefined, timeframe: SignalsTimeframe, now: Date): boolean {
  if (timeframe === "ALL") return true;
  const timestamp = getTimestamp(value);
  if (timestamp === null) return false;

  const date = new Date(timestamp);
  if (timeframe === "TODAY") {
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    );
  }

  const dayOfWeek = now.getDay();
  const startOfWeek = new Date(now);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(now.getDate() - ((dayOfWeek + 6) % 7));

  if (timeframe === "THIS_WEEK") {
    return timestamp >= startOfWeek.getTime();
  }

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return timestamp >= startOfMonth.getTime();
}

function compareSignals(a: SignalFilterItem, b: SignalFilterItem, sortBy: SignalSortOption): number {
  if (sortBy === "SCORE_ASC") return a.riskScore - b.riskScore;
  if (sortBy === "NEWEST") {
    const aTime = getTimestamp(a.createdAt) ?? 0;
    const bTime = getTimestamp(b.createdAt) ?? 0;
    return bTime - aTime;
  }
  if (sortBy === "OLDEST") {
    const aTime = getTimestamp(a.createdAt) ?? Number.MAX_SAFE_INTEGER;
    const bTime = getTimestamp(b.createdAt) ?? Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  }
  return b.riskScore - a.riskScore;
}

function filterSignals<T extends SignalFilterItem>(rows: T[], filters: SignalsFilterState): T[] {
  const now = new Date();
  return [...rows]
    .filter((signal) => {
      if (filters.selectedSetupTypes.length > 0 && !filters.selectedSetupTypes.includes(normalizeSignalSetupType(signal.setupType))) {
        return false;
      }
      if (signal.riskScore < filters.riskScoreMin) return false;
      if (filters.selectedExchanges.length > 0) {
        const normalizedExchange = normalizeSignalExchange(signal.exchange);
        if (!normalizedExchange || !filters.selectedExchanges.includes(normalizedExchange)) {
          return false;
        }
      }
      if (!isInTimeframe(signal.createdAt, filters.timeframe, now)) return false;
      return true;
    })
    .sort((a, b) => compareSignals(a, b, filters.sortBy));
}

function toggleFromList<T extends string>(items: T[], value: T): T[] {
  return items.includes(value) ? items.filter((item) => item !== value) : [...items, value];
}

export function useSignalsFilter() {
  const [filters, setFilters] = useState<SignalsFilterState>(DEFAULT_FILTERS);

  const toggleSetupType = useCallback((setupType: SignalSetupType) => {
    setFilters((prev) => ({
      ...prev,
      selectedSetupTypes: toggleFromList(prev.selectedSetupTypes, setupType),
    }));
  }, []);

  const setRiskScoreMin = useCallback((value: number) => {
    setFilters((prev) => ({
      ...prev,
      riskScoreMin: clampScore(value),
    }));
  }, []);

  const toggleExchange = useCallback((exchange: SignalExchange) => {
    setFilters((prev) => ({
      ...prev,
      selectedExchanges: toggleFromList(prev.selectedExchanges, exchange),
    }));
  }, []);

  const setTimeframe = useCallback((timeframe: SignalsTimeframe) => {
    setFilters((prev) => ({
      ...prev,
      timeframe,
    }));
  }, []);

  const setSortBy = useCallback((sortBy: SignalSortOption) => {
    setFilters((prev) => ({
      ...prev,
      sortBy,
    }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const applyFilters = useCallback(<T extends SignalFilterItem>(rows: T[]) => filterSignals(rows, filters), [filters]);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.selectedSetupTypes.length > 0 ||
      filters.riskScoreMin !== DEFAULT_FILTERS.riskScoreMin ||
      filters.selectedExchanges.length > 0 ||
      filters.timeframe !== DEFAULT_FILTERS.timeframe ||
      filters.sortBy !== DEFAULT_FILTERS.sortBy
    );
  }, [filters]);

  return {
    filters,
    hasActiveFilters,
    toggleSetupType,
    setRiskScoreMin,
    toggleExchange,
    setTimeframe,
    setSortBy,
    resetFilters,
    applyFilters,
  };
}
