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
import { enrichCompaniesWithLogos } from "../utils/companyLogoEnrichment";
import { useCompaniesFilter } from "../hooks/useCompaniesFilter";
import {
  TERMINAL_APP_BG,
  TERMINAL_PAGE_SHELL,
  TERMINAL_PAGE_SUBTITLE,
  TERMINAL_PAGE_TITLE,
  TERMINAL_PANEL_MUTED,
  TERMINAL_SECTION_TITLE,
  TERMINAL_TEXT_MUTED,
} from "../components/terminal/terminalStyles";
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

      const merged = Array.from(mergedCompanies.values());
      setCompanies(await enrichCompaniesWithLogos(merged));
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
    <div className={TERMINAL_APP_BG}>
      <div className={`${TERMINAL_PAGE_SHELL} py-4 sm:py-6`}>
        <header className="mb-6 border-b border-terminal-borderMuted pb-4">
          <p className={TERMINAL_SECTION_TITLE}>
            {t("home.marketBrowser", { defaultValue: "Market browser" })}
          </p>
          <h1 className={`${TERMINAL_PAGE_TITLE} mt-1`}>{t("home.title", { defaultValue: "Companies" })}</h1>
          <p className={TERMINAL_PAGE_SUBTITLE}>
            {t("companies.pageSubtitle", {
              defaultValue: "Search and filter companies by market and sector, then open full analysis.",
            })}
          </p>
        </header>

        <div className="mb-6">
          <CompanySearchAutocomplete
            limit={8}
            initialValue={initialSearchQuery}
            variant="terminal"
            placeholder={t("home.searchPlaceholder", { defaultValue: "Search by name or ticker..." })}
          />
        </div>

        <p className={`mb-6 ${TERMINAL_SECTION_TITLE}`}>
          {t("home.results", { defaultValue: "Results" })}: {visibleCompanies.length}
          {filters.onlyDividendStocks && dividendFilterLoading
            ? ` · ${t("companies.filterDividendLoading", { defaultValue: "Loading dividend list…" })}`
            : null}
        </p>

        {error ? (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-terminal-negative/30 bg-terminal-negative/10 px-4 py-3 text-sm text-terminal-negative">
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
              className="rounded-md border border-terminal-negative/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-terminal-negative transition hover:bg-terminal-negative/15"
            >
              {t("home.retry", { defaultValue: "Try again" })}
            </button>
          </div>
        ) : null}

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
            {loading ? (
              <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" aria-live="polite" aria-label={t("common.loading")}>
                {Array.from({ length: 9 }).map((_, index) => (
                  <div key={`skeleton-${index}`} className={`${TERMINAL_PANEL_MUTED} overflow-hidden p-4`}>
                    <div className="mb-4 h-20 rounded-lg bg-terminal-panelSecondary animate-pulse" />
                    <div className="mb-3 h-4 w-1/2 rounded bg-terminal-panelSecondary animate-pulse" />
                    <div className="mb-3 h-3 w-4/5 rounded bg-terminal-panelSecondary animate-pulse" />
                    <div className="mb-4 h-8 w-2/3 rounded bg-terminal-panelSecondary animate-pulse" />
                    <div className="h-6 w-24 rounded-full bg-terminal-panelSecondary animate-pulse" />
                  </div>
                ))}
              </div>
            ) : null}

            {!loading && visibleCompanies.length === 0 ? (
              <div className={`${TERMINAL_PANEL_MUTED} flex flex-col items-center justify-center border-dashed px-6 py-14 text-center`}>
                <BuildingOffice2Icon className="mb-3 h-10 w-10 text-terminal-textMuted" aria-hidden />
                <p className={TERMINAL_TEXT_MUTED}>
                  {hasActiveFilters
                    ? t("home.emptySector", { defaultValue: "No companies in this sector yet." })
                    : t("home.emptySelectSector", { defaultValue: "Choose a sector or run a search to see companies." })}
                </p>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {visibleCompanies.map((c) => (
                <CompanyCard key={c.symbol} company={c} onOpenBrief={setBriefCompany} />
              ))}
            </div>
          </div>
        </div>

        <AIBriefDrawer company={briefCompany} open={briefCompany !== null} onClose={() => setBriefCompany(null)} />
      </div>
    </div>
  );
}
