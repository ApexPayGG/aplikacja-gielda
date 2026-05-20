import { BuildingOffice2Icon } from "@heroicons/react/24/outline";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { CompaniesFilter } from "../components/CompaniesFilter";
import { CompanySearchAutocomplete } from "../components/CompanySearchAutocomplete";
import { AIBriefDrawer } from "../components/AIBriefDrawer";
import { CompanyCard } from "../components/CompanyCard";
import type { Company } from "../services/api";
import { getCompanyBySector, getDividendScreener } from "../services/api";
import { useCompaniesFilter } from "../hooks/useCompaniesFilter";
import { GlassPageShell } from "../components/behavioral-coach/GlassPageShell";
import { GLASS_INNER_PANEL, GLASS_PAGE_SUBTITLE, GLASS_PAGE_TITLE } from "../components/behavioral-coach/glassStyles";
import { apiErrorMessage } from "../utils/apiErrorMessage";

const SOURCE_SECTORS = [
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

export function CompaniesPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const initialSearchQuery = searchParams.get("q")?.trim() ?? "";
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [briefCompany, setBriefCompany] = useState<Company | null>(null);
  const [dividendSymbols, setDividendSymbols] = useState<Set<string> | null>(null);
  const [dividendFilterLoading, setDividendFilterLoading] = useState(false);
  const { filters, hasActiveFilters, toggleSector, setMarketCap, setPeRange, setOnlyDividendStocks, setSortBy, resetFilters, applyFilters } =
    useCompaniesFilter();

  const loadCompanies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const requests = await Promise.allSettled(SOURCE_SECTORS.map((sector) => getCompanyBySector(sector, 1, 40)));
      const mergedCompanies = new Map<string, Company>();

      for (const response of requests) {
        if (response.status !== "fulfilled") continue;
        for (const company of response.value.items) {
          const symbol = String(company.symbol ?? "")
            .trim()
            .toUpperCase();
          if (!symbol) continue;
          if (!mergedCompanies.has(symbol)) {
            mergedCompanies.set(symbol, company);
          }
        }
      }

      const failedResponse = requests.find((response): response is PromiseRejectedResult => response.status === "rejected");
      if (failedResponse) {
        setError(apiErrorMessage(failedResponse.reason));
      }

      setCompanies(Array.from(mergedCompanies.values()));
    } catch (e) {
      setError(apiErrorMessage(e));
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCompanies();
  }, [loadCompanies]);

  useEffect(() => {
    if (!filters.onlyDividendStocks) {
      setDividendSymbols(null);
      setDividendFilterLoading(false);
      return;
    }

    let cancelled = false;
    setDividendFilterLoading(true);
    void getDividendScreener({ minYield: 0.01 })
      .then((response) => {
        if (cancelled) return;
        const symbols = new Set(
          response.data
            .filter((row) => row.dividendYield > 0)
            .map((row) => row.ticker.trim().toUpperCase())
            .filter(Boolean),
        );
        setDividendSymbols(symbols);
      })
      .catch(() => {
        if (!cancelled) setDividendSymbols(new Set());
      })
      .finally(() => {
        if (!cancelled) setDividendFilterLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filters.onlyDividendStocks]);

  const visibleCompanies = useMemo(() => {
    const symbolSet = filters.onlyDividendStocks ? dividendSymbols : null;
    return applyFilters(companies, symbolSet);
  }, [companies, applyFilters, filters.onlyDividendStocks, dividendSymbols]);

  return (
    <GlassPageShell>
      <header className="mb-8">
        <h1 className={GLASS_PAGE_TITLE}>{t("home.title", { defaultValue: "Spółki" })}</h1>
        <p className={GLASS_PAGE_SUBTITLE}>
          {t("home.subtitle", {
            defaultValue: "Szybko przeszukuj i filtruj spółki według rynku oraz sektora, aby przejść do pełnej analizy.",
          })}
        </p>
      </header>

      <div className="mb-6">
        <CompanySearchAutocomplete
          limit={8}
          initialValue={initialSearchQuery}
          variant="glass"
          placeholder={t("home.searchPlaceholder", { defaultValue: "Szukaj po nazwie lub tickerze..." })}
        />
      </div>

      <p className="mb-6 text-xs font-semibold uppercase tracking-wide text-white/50">
        {t("home.results", { defaultValue: "Wyniki" })}: {visibleCompanies.length}
        {filters.onlyDividendStocks && dividendFilterLoading
          ? ` · ${t("companies.filterDividendLoading", { defaultValue: "Ładowanie listy dywidendowych…" })}`
          : null}
      </p>

      {error && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <span>
            {companies.length > 0
              ? t("home.partialError", {
                  defaultValue: "Some sectors failed to load. Showing available results.",
                })
              : error}
          </span>
          <button
            type="button"
            onClick={() => void loadCompanies()}
            className="rounded-lg border border-current px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition hover:bg-white/10"
          >
            {t("home.retry", { defaultValue: "Try again" })}
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <aside className="self-start">
          <div className="sticky top-24">
            <CompaniesFilter
              filters={filters}
              dividendFilterLoading={dividendFilterLoading}
              onToggleSector={toggleSector}
              onMarketCapChange={setMarketCap}
              onPeRangeChange={setPeRange}
              onDividendToggle={setOnlyDividendStocks}
              onSortChange={setSortBy}
              onReset={resetFilters}
            />
          </div>
        </aside>

        <div>
          {loading && (
            <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" aria-live="polite" aria-label={t("common.loading")}>
              {Array.from({ length: 9 }).map((_, index) => (
                <div key={`skeleton-${index}`} className={`${GLASS_INNER_PANEL} overflow-hidden p-4`}>
                  <div className="mb-4 h-20 rounded-xl bg-white/10" />
                  <div className="mb-3 h-4 w-1/2 rounded bg-white/10" />
                  <div className="mb-3 h-3 w-4/5 rounded bg-white/10" />
                  <div className="mb-4 h-8 w-2/3 rounded bg-white/10" />
                  <div className="h-6 w-24 rounded-full bg-white/10" />
                </div>
              ))}
            </div>
          )}

          {!loading && visibleCompanies.length === 0 && (
            <div className={`${GLASS_INNER_PANEL} flex flex-col items-center justify-center border-dashed px-6 py-14 text-center`}>
              <BuildingOffice2Icon className="mb-3 h-10 w-10 text-white/40" aria-hidden />
              <p className="text-sm text-white/60">
                {hasActiveFilters
                  ? t("home.emptySector", { defaultValue: "Brak spółek dla wybranych filtrów." })
                  : t("home.emptySelectSector", { defaultValue: "Brak wyników. Spróbuj zmienić filtry lub wyszukaj spółkę." })}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {visibleCompanies.map((c) => (
              <CompanyCard key={c.symbol} company={c} onOpenBrief={setBriefCompany} />
            ))}
          </div>
        </div>
      </div>

      <AIBriefDrawer company={briefCompany} open={briefCompany !== null} onClose={() => setBriefCompany(null)} />
    </GlassPageShell>
  );
}
