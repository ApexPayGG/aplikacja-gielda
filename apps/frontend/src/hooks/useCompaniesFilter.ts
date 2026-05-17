import { useCallback, useMemo, useState } from "react";

export const COMPANY_FILTER_SECTORS = ["Technology", "Finance", "Energy", "Healthcare", "Consumer", "Industrial", "Other"] as const;
export const COMPANY_MARKET_CAP_OPTIONS = ["ALL", "UNDER_1B", "1B_10B", "10B_100B", "OVER_100B"] as const;
export const COMPANY_SORT_OPTIONS = ["NAME", "MARKET_CAP", "PRICE_CHANGE"] as const;
export const PE_RATIO_MIN = 0;
export const PE_RATIO_MAX = 80;

export type CompanyFilterSector = (typeof COMPANY_FILTER_SECTORS)[number];
export type CompanyMarketCapFilter = (typeof COMPANY_MARKET_CAP_OPTIONS)[number];
export type CompanySortOption = (typeof COMPANY_SORT_OPTIONS)[number];

export type CompanyFilterItem = {
  symbol: string;
  name: string;
  sector?: string | null;
  marketCap?: unknown;
  market_cap?: unknown;
  marketCapitalization?: unknown;
  capitalization?: unknown;
  cap?: unknown;
  peRatio?: unknown;
  pe_ratio?: unknown;
  pe?: unknown;
  trailingPE?: unknown;
  trailingPe?: unknown;
  dividendYield?: unknown;
  dividend_yield?: unknown;
  dividend?: unknown;
  yield?: unknown;
  changePct?: unknown;
  changePercent?: unknown;
  priceChangePercent?: unknown;
  price_change_percent?: unknown;
};

export type CompaniesFilterState = {
  selectedSectors: CompanyFilterSector[];
  marketCap: CompanyMarketCapFilter;
  peMin: number;
  peMax: number;
  onlyDividendStocks: boolean;
  sortBy: CompanySortOption;
};

const DEFAULT_FILTERS: CompaniesFilterState = {
  selectedSectors: [],
  marketCap: "ALL",
  peMin: PE_RATIO_MIN,
  peMax: PE_RATIO_MAX,
  onlyDividendStocks: false,
  sortBy: "NAME",
};

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;

  const normalized = value.trim().replace(/[$,\s]/g, "").toUpperCase();
  if (!normalized) return null;

  let multiplier = 1;
  let numericPart = normalized;

  if (normalized.endsWith("T")) {
    multiplier = 1_000_000_000_000;
    numericPart = normalized.slice(0, -1);
  } else if (normalized.endsWith("B")) {
    multiplier = 1_000_000_000;
    numericPart = normalized.slice(0, -1);
  } else if (normalized.endsWith("M")) {
    multiplier = 1_000_000;
    numericPart = normalized.slice(0, -1);
  } else if (normalized.endsWith("K")) {
    multiplier = 1_000;
    numericPart = normalized.slice(0, -1);
  }

  const parsed = Number(numericPart);
  if (!Number.isFinite(parsed)) return null;
  return parsed * multiplier;
}

function pickFirstNumber(company: CompanyFilterItem, keys: string[]): number | null {
  const source = company as Record<string, unknown>;
  for (const key of keys) {
    const value = readNumber(source[key]);
    if (value !== null) return value;
  }
  return null;
}

function normalizeSectorLabel(sector: string | null | undefined): CompanyFilterSector {
  const value = String(sector ?? "")
    .trim()
    .toLowerCase();

  if (/(tech|software|internet|semiconductor|communication)/.test(value)) return "Technology";
  if (/(finance|financial|bank|insurance|real estate)/.test(value)) return "Finance";
  if (/energy|oil|gas|renewable/.test(value)) return "Energy";
  if (/(health|pharma|biotech|medical)/.test(value)) return "Healthcare";
  if (/(consumer|retail|cyclical|defensive)/.test(value)) return "Consumer";
  if (/(industrial|materials|utility|transport|manufacturing)/.test(value)) return "Industrial";
  return "Other";
}

function readMarketCap(company: CompanyFilterItem): number | null {
  return pickFirstNumber(company, ["marketCap", "market_cap", "marketCapitalization", "capitalization", "cap"]);
}

function readPeRatio(company: CompanyFilterItem): number | null {
  return pickFirstNumber(company, ["peRatio", "pe_ratio", "pe", "trailingPE", "trailingPe"]);
}

function readDividendYield(company: CompanyFilterItem): number | null {
  return pickFirstNumber(company, ["dividendYield", "dividend_yield", "dividend", "yield"]);
}

function readPriceChangePct(company: CompanyFilterItem): number | null {
  return pickFirstNumber(company, ["changePct", "changePercent", "priceChangePercent", "price_change_percent"]);
}

function matchesMarketCapFilter(marketCap: number | null, filter: CompanyMarketCapFilter): boolean {
  if (filter === "ALL") return true;
  if (marketCap === null) return false;
  if (filter === "UNDER_1B") return marketCap < 1_000_000_000;
  if (filter === "1B_10B") return marketCap >= 1_000_000_000 && marketCap < 10_000_000_000;
  if (filter === "10B_100B") return marketCap >= 10_000_000_000 && marketCap <= 100_000_000_000;
  return marketCap > 100_000_000_000;
}

function compareCompanies(a: CompanyFilterItem, b: CompanyFilterItem, sortBy: CompanySortOption): number {
  if (sortBy === "MARKET_CAP") {
    const aMarketCap = readMarketCap(a) ?? -1;
    const bMarketCap = readMarketCap(b) ?? -1;
    if (bMarketCap !== aMarketCap) return bMarketCap - aMarketCap;
    return a.name.localeCompare(b.name);
  }

  if (sortBy === "PRICE_CHANGE") {
    const aChange = readPriceChangePct(a) ?? -Infinity;
    const bChange = readPriceChangePct(b) ?? -Infinity;
    if (bChange !== aChange) return bChange - aChange;
    return a.name.localeCompare(b.name);
  }

  return a.name.localeCompare(b.name);
}

function filterCompanies<T extends CompanyFilterItem>(rows: T[], filters: CompaniesFilterState): T[] {
  const isPeRangeDefault = filters.peMin === PE_RATIO_MIN && filters.peMax === PE_RATIO_MAX;

  return [...rows]
    .filter((company) => {
      if (filters.selectedSectors.length > 0) {
        const sector = normalizeSectorLabel(typeof company.sector === "string" ? company.sector : null);
        if (!filters.selectedSectors.includes(sector)) return false;
      }

      const marketCap = readMarketCap(company);
      if (!matchesMarketCapFilter(marketCap, filters.marketCap)) return false;

      const peRatio = readPeRatio(company);
      if (!isPeRangeDefault) {
        if (peRatio === null) return false;
        if (peRatio < filters.peMin || peRatio > filters.peMax) return false;
      }

      if (filters.onlyDividendStocks) {
        const dividendYield = readDividendYield(company);
        if (dividendYield === null || dividendYield <= 0) return false;
      }

      return true;
    })
    .sort((a, b) => compareCompanies(a, b, filters.sortBy));
}

function clampPe(value: number): number {
  if (!Number.isFinite(value)) return PE_RATIO_MIN;
  return Math.min(PE_RATIO_MAX, Math.max(PE_RATIO_MIN, Math.round(value)));
}

function toggleFromList<T extends string>(items: T[], value: T): T[] {
  return items.includes(value) ? items.filter((item) => item !== value) : [...items, value];
}

export function useCompaniesFilter() {
  const [filters, setFilters] = useState<CompaniesFilterState>(DEFAULT_FILTERS);

  const toggleSector = useCallback((sector: CompanyFilterSector) => {
    setFilters((prev) => ({
      ...prev,
      selectedSectors: toggleFromList(prev.selectedSectors, sector),
    }));
  }, []);

  const setMarketCap = useCallback((marketCap: CompanyMarketCapFilter) => {
    setFilters((prev) => ({
      ...prev,
      marketCap,
    }));
  }, []);

  const setPeRange = useCallback((peMin: number, peMax: number) => {
    const min = clampPe(Math.min(peMin, peMax));
    const max = clampPe(Math.max(peMin, peMax));
    setFilters((prev) => ({
      ...prev,
      peMin: min,
      peMax: max,
    }));
  }, []);

  const setOnlyDividendStocks = useCallback((value: boolean) => {
    setFilters((prev) => ({
      ...prev,
      onlyDividendStocks: value,
    }));
  }, []);

  const setSortBy = useCallback((sortBy: CompanySortOption) => {
    setFilters((prev) => ({
      ...prev,
      sortBy,
    }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const applyFilters = useCallback(<T extends CompanyFilterItem>(rows: T[]) => filterCompanies(rows, filters), [filters]);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.selectedSectors.length > 0 ||
      filters.marketCap !== DEFAULT_FILTERS.marketCap ||
      filters.peMin !== DEFAULT_FILTERS.peMin ||
      filters.peMax !== DEFAULT_FILTERS.peMax ||
      filters.onlyDividendStocks !== DEFAULT_FILTERS.onlyDividendStocks ||
      filters.sortBy !== DEFAULT_FILTERS.sortBy
    );
  }, [filters]);

  return {
    filters,
    hasActiveFilters,
    toggleSector,
    setMarketCap,
    setPeRange,
    setOnlyDividendStocks,
    setSortBy,
    resetFilters,
    applyFilters,
  };
}
