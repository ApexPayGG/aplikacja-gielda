import { BuildingOffice2Icon } from "@heroicons/react/24/outline";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { CompaniesFilter } from "../components/CompaniesFilter";
import { CompanySearchAutocomplete } from "../components/CompanySearchAutocomplete";
import { CompanyCard } from "../components/CompanyCard";
import type { Company } from "../services/api";
import { getCompanyBySector } from "../services/api";
import { useCompaniesFilter } from "../hooks/useCompaniesFilter";
import { colors } from "../styles/designSystem";
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

export function Home() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const initialSearchQuery = searchParams.get("q")?.trim() ?? "";
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const visibleCompanies = useMemo(() => {
    return applyFilters(companies);
  }, [companies, applyFilters]);

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

      <div className="mb-6">
        <CompanySearchAutocomplete
          limit={8}
          initialValue={initialSearchQuery}
          placeholder={t("home.searchPlaceholder", { defaultValue: "Szukaj po nazwie lub tickerze..." })}
        />
      </div>

      <p className="mb-6 text-xs font-semibold uppercase tracking-wide text-textMuted">
        {t("home.results", { defaultValue: "Wyniki" })}: {visibleCompanies.length}
      </p>

      {error && (
        <div
          className="mb-6 rounded-xl border px-4 py-3 text-sm"
          style={{ borderColor: colors.negative, backgroundColor: "rgba(229,57,53,0.08)", color: colors.negative }}
        >
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <aside className="self-start">
          <div className="sticky top-24">
            <CompaniesFilter
              filters={filters}
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
              <p className="text-sm text-textSecondary">
                {hasActiveFilters
                  ? t("home.emptySector", { defaultValue: "Brak spółek dla wybranych filtrów." })
                  : t("home.emptySelectSector", { defaultValue: "Brak wyników. Spróbuj zmienić filtry lub wyszukaj spółkę." })}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {visibleCompanies.map((c) => (
              <CompanyCard key={c.symbol} company={c} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
