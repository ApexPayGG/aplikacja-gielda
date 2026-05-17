import { BuildingOffice2Icon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CompanyCard } from "../components/CompanyCard";
import type { Company } from "../services/api";
import { getCompanyBySector, searchCompanies } from "../services/api";
import { colors } from "../styles/designSystem";
import { apiErrorMessage } from "../utils/apiErrorMessage";

const SECTORS = [
  "All",
  "Technology",
  "Financial Services",
  "Healthcare",
  "Consumer Cyclical",
  "Industrials",
  "Energy",
  "Communication Services",
  "Consumer Defensive",
  "Utilities",
  "Real Estate",
  "Basic Materials",
] as const;

const MARKET_FILTERS = ["All", "GPW", "US", "DAX", "LSE", "KO", "HK"] as const;

function normalizeMarket(company: Company): string {
  const exchange = String(company.exchange ?? "")
    .trim()
    .toUpperCase();
  if (exchange) return exchange;
  const symbol = String(company.symbol ?? "")
    .trim()
    .toUpperCase();
  const [, suffix = ""] = symbol.split(".");
  return suffix;
}

function matchesMarket(company: Company, market: (typeof MARKET_FILTERS)[number]): boolean {
  if (market === "All") return true;
  const value = normalizeMarket(company);

  if (market === "GPW") {
    return ["WA", "WAR", "WSE", "GPW", "PL"].some((code) => value.includes(code));
  }
  if (market === "US") {
    return ["US", "NASDAQ", "NYSE", "AMEX", "ARCA", "BATS"].some((code) => value.includes(code));
  }
  if (market === "DAX") {
    return ["DE", "XETRA", "FRA", "GER", "DAX"].some((code) => value.includes(code));
  }
  if (market === "LSE") {
    return ["LSE", "LON", "UK", "GB"].some((code) => value.includes(code));
  }
  if (market === "KO") {
    return ["KO", "KOSDAQ", "KOSPI", "KRX"].some((code) => value.includes(code));
  }
  if (market === "HK") {
    return ["HK", "HKEX", "HKG"].some((code) => value.includes(code));
  }
  return true;
}

export function Home() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("All");
  const [market, setMarket] = useState<(typeof MARKET_FILTERS)[number]>("All");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSector = useCallback(async (s: string) => {
    if (s === "All") {
      setCompanies([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await getCompanyBySector(s, 1, 48);
      setCompanies(res.items);
    } catch (e) {
      setError(apiErrorMessage(e));
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSector(sector);
  }, [sector, loadSector]);

  const runSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await searchCompanies(q, 48);
      setCompanies(rows);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const visibleCompanies = useMemo(() => companies.filter((company) => matchesMarket(company, market)), [companies, market]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-textPrimary">{t("home.title", { defaultValue: "Spółki" })}</h1>
        <p className="mt-2 max-w-3xl text-sm text-textSecondary">
          {t("home.subtitle", {
            defaultValue: "Szybko przeszukuj i filtruj spółki według rynku oraz sektora, aby przejść do pełnej analizy.",
          })}
        </p>
      </header>

      <form
        className="mb-6"
        onSubmit={(event) => {
          event.preventDefault();
          void runSearch();
        }}
      >
        <div className="relative">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-brandDark" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("home.searchPlaceholder", { defaultValue: "Szukaj po nazwie lub tickerze..." })}
            className="h-14 w-full rounded-2xl border border-border bg-bgPrimary pl-14 pr-28 text-base text-textPrimary shadow-sm outline-none transition focus:border-brandCyan focus:ring-2 focus:ring-brandCyan/30"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-brandDark px-4 py-2 text-sm font-semibold text-white transition hover:bg-brandMedium disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!query.trim()}
          >
            {t("common.search", { defaultValue: "Szukaj" })}
          </button>
        </div>
      </form>

      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {MARKET_FILTERS.map((option) => {
            const active = market === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => setMarket(option)}
                className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
                  active
                    ? "border-brandDark bg-brandDark text-white shadow-sm"
                    : "border-border bg-bgSecondary text-textSecondary hover:border-borderStrong hover:text-brandDark"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="sector-select" className="text-xs font-semibold uppercase tracking-wide text-textSecondary">
            {t("home.sectorLabel", { defaultValue: "Sektor" })}
          </label>
          <select
            id="sector-select"
            value={sector}
            onChange={(event) => setSector(event.target.value)}
            className="min-w-[210px] rounded-xl border border-border bg-bgPrimary px-3 py-2 text-sm text-textPrimary shadow-[0_8px_20px_rgba(45,10,107,0.08)] outline-none transition focus:border-brandCyan focus:ring-2 focus:ring-brandCyan/30"
          >
            {SECTORS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div
          className="mb-6 rounded-xl border px-4 py-3 text-sm"
          style={{ borderColor: colors.negative, backgroundColor: "rgba(229,57,53,0.08)", color: colors.negative }}
        >
          {error}
        </div>
      )}

      {loading && (
        <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4" aria-live="polite" aria-label={t("common.loading")}>
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={`skeleton-${index}`} className="overflow-hidden rounded-2xl border border-border bg-bgSecondary p-4">
              <div className="mb-4 h-20 rounded-xl bg-bgTertiary" />
              <div className="mb-3 h-4 w-1/2 rounded bg-bgTertiary" />
              <div className="mb-3 h-3 w-4/5 rounded bg-bgTertiary" />
              <div className="mb-4 h-8 w-2/3 rounded bg-bgTertiary" />
              <div className="h-6 w-24 rounded-full bg-bgTertiary" />
            </div>
          ))}
        </div>
      )}

      {!loading && visibleCompanies.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-bgSecondary px-6 py-14 text-center">
          <BuildingOffice2Icon className="mb-3 h-10 w-10 text-textMuted" aria-hidden />
          <p className="mb-4 text-sm text-textSecondary">
            {sector === "All"
              ? t("home.emptySelectSector", { defaultValue: "Wybierz sektor lub wpisz zapytanie, aby wyświetlić spółki." })
              : t("home.emptySector", { defaultValue: "Brak spółek dla wybranych filtrów." })}
          </p>
          <button
            type="button"
            onClick={() => void runSearch()}
            className="rounded-xl border border-brandDark/25 bg-bgPrimary px-4 py-2 text-sm font-semibold text-brandDark transition hover:bg-brandDark hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!query.trim()}
          >
            {t("common.search", { defaultValue: "Szukaj" })}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {visibleCompanies.map((c) => (
          <CompanyCard key={c.symbol} company={c} />
        ))}
      </div>
    </div>
  );
}
