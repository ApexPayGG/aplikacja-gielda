import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CompanyCard } from "../components/CompanyCard";
import { SearchBar } from "../components/SearchBar";
import { SectorFilter } from "../components/SectorFilter";
import type { Company } from "../services/api";
import { getCompanyBySector, searchCompanies } from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";

export function Home() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("All");
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
      const rows = await searchCompanies(q, 24);
      setCompanies(rows);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-white">{t("home.title", { defaultValue: "Companies" })}</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          {t("home.subtitle", {
            defaultValue: "Search by name or symbol, or filter by sector. Cards link to full quote, news, and AI brief.",
          })}
        </p>
      </header>

      <div className="mb-8 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <SearchBar value={query} onChange={setQuery} onSubmit={() => void runSearch()} />
        <SectorFilter value={sector} onChange={setSector} />
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading && (
        <p className="mb-6 text-sm text-slate-500" aria-live="polite">
          {t("common.loading")}
        </p>
      )}

      {!loading && companies.length === 0 && (
        <p className="rounded-2xl border border-dashed border-surface-border bg-slate-900/30 px-6 py-12 text-center text-sm text-slate-500">
          {sector === "All"
            ? t("home.emptySelectSector", { defaultValue: "Choose a sector or run a search to see companies." })
            : t("home.emptySector", { defaultValue: "No companies in this sector yet." })}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {companies.map((c) => (
          <CompanyCard key={c.symbol} company={c} />
        ))}
      </div>
    </div>
  );
}
