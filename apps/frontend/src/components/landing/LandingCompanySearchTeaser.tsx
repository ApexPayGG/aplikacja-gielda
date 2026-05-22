import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { searchCompaniesPublic, type CompanySearchSuggestion } from "../../services/api";
import { CompanyLogo } from "../CompanyLogo";

const DEBOUNCE_MS = 300;
const LIMIT = 6;

export function LandingCompanySearchTeaser() {
  const { t } = useTranslation("common");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<CompanySearchSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CompanySearchSuggestion | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!debouncedQuery) {
        setResults([]);
        setLoading(false);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const rows = await searchCompaniesPublic(debouncedQuery, LIMIT);
        if (!active) return;
        setResults(rows);
      } catch {
        if (!active) return;
        setResults([]);
        setError(t("landing.searchTeaser.error"));
      } finally {
        if (active) setLoading(false);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [debouncedQuery, t]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!rootRef.current) return;
      if (event.target instanceof Node && !rootRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const showDropdown = isOpen && debouncedQuery.length > 0 && (loading || results.length > 0 || error);

  function pickCompany(company: CompanySearchSuggestion): void {
    setSelected(company);
    setQuery(company.symbol);
    setIsOpen(false);
  }

  return (
    <section
      id="company-search"
      className="relative scroll-mt-24 overflow-hidden px-4 py-20"
      aria-labelledby="landing-search-title"
    >
      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <h2 id="landing-search-title" className="section-h2 text-white">
          {t("landing.searchTeaser.title")}
        </h2>
        <p className="landing-body mt-4 text-[#94a3b8]">{t("landing.searchTeaser.subtitle")}</p>
      </div>

      <div ref={rootRef} className="relative z-10 mx-auto mt-10 max-w-xl">
        <div className="relative">
          <MagnifyingGlassIcon
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#a855f7]/60"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(null);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={t("landing.searchTeaser.placeholder")}
            aria-label={t("landing.searchTeaser.placeholder")}
            className="w-full rounded-2xl border border-white/15 bg-white/[0.06] py-3.5 pl-12 pr-4 text-base text-white outline-none transition placeholder:text-[#94a3b8] focus:border-[#22d3ee]/40"
          />
        </div>

        {showDropdown ? (
          <ul
            className="absolute left-0 right-0 z-20 mt-2 max-h-64 overflow-auto rounded-2xl border border-white/10 bg-[#0f111c]/95 py-2 shadow-xl backdrop-blur-xl"
            role="listbox"
          >
            {loading ? (
              <li className="px-4 py-3 text-sm text-[#94a3b8]">{t("common.loading", { defaultValue: "Loading..." })}</li>
            ) : error ? (
              <li className="px-4 py-3 text-sm text-red-300">{error}</li>
            ) : results.length === 0 ? (
              <li className="px-4 py-3 text-sm text-[#94a3b8]">{t("landing.searchTeaser.empty")}</li>
            ) : (
              results.map((row) => (
                <li key={`${row.symbol}-${row.exchange ?? ""}`}>
                  <button
                    type="button"
                    role="option"
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/5"
                    onClick={() => pickCompany(row)}
                  >
                    <CompanyLogo symbol={row.symbol} logoUrl={row.logoUrl} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-sm font-bold text-white">{row.symbol}</span>
                      <span className="block truncate text-xs text-[#94a3b8]">{row.name}</span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}

        {selected ? (
          <div className="glass-section mt-6 p-6 text-left">
            <div className="flex items-center gap-3">
              <CompanyLogo symbol={selected.symbol} logoUrl={selected.logoUrl} size="md" />
              <div>
                <p className="font-mono text-lg font-bold text-white">{selected.symbol}</p>
                <p className="text-sm text-[#94a3b8]">{selected.name}</p>
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                to="/register"
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
                style={{ backgroundColor: "#a855f7" }}
              >
                {t("landing.searchTeaser.unlockBrief")}
              </Link>
              <Link
                to="/login"
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                {t("landing.searchTeaser.signInWatchlist")}
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
