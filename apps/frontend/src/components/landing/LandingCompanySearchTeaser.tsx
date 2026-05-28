import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { searchCompaniesPublic, type CompanySearchSuggestion } from "../../services/api";
import { CompanyLogo } from "../CompanyLogo";
import {
  TERMINAL_INPUT,
  TERMINAL_LANDING_CTA_PRIMARY,
  TERMINAL_LANDING_CTA_SECONDARY,
  TERMINAL_LANDING_SECTION,
  TERMINAL_PROOF_CARD,
  TERMINAL_SEARCH_DROPDOWN,
} from "../terminal/terminalStyles";

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
      className={TERMINAL_LANDING_SECTION}
      aria-labelledby="landing-search-title"
    >
      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <h2 id="landing-search-title" className="section-h2 text-terminal-text">
          {t("landing.searchTeaser.title")}
        </h2>
        <p className="landing-body mt-4 text-terminal-textSecondary">{t("landing.searchTeaser.subtitle")}</p>
      </div>

      <div ref={rootRef} className="relative z-10 mx-auto mt-10 max-w-xl">
        <div className="relative">
          <MagnifyingGlassIcon
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-terminal-cyan/60"
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
            className={`${TERMINAL_INPUT} rounded-xl py-3.5 pl-12 pr-4 text-base`}
          />
        </div>

        {showDropdown ? (
          <ul className={`${TERMINAL_SEARCH_DROPDOWN} max-h-64 overflow-auto py-2`} role="listbox">
            {loading ? (
              <li className="px-4 py-3 text-sm text-terminal-textMuted">
                {t("common.loading", { defaultValue: "Loading..." })}
              </li>
            ) : error ? (
              <li className="px-4 py-3 text-sm text-terminal-negative">{error}</li>
            ) : results.length === 0 ? (
              <li className="px-4 py-3 text-sm text-terminal-textMuted">{t("landing.searchTeaser.empty")}</li>
            ) : (
              results.map((row) => (
                <li key={`${row.symbol}-${row.exchange ?? ""}`}>
                  <button
                    type="button"
                    role="option"
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-terminal-panelSecondary"
                    onClick={() => pickCompany(row)}
                  >
                    <CompanyLogo symbol={row.symbol} logoUrl={row.logoUrl} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-sm font-bold text-terminal-text">{row.symbol}</span>
                      <span className="block truncate text-xs text-terminal-textMuted">{row.name}</span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}

        {selected ? (
          <div className={`${TERMINAL_PROOF_CARD} mt-6 p-6 text-left`}>
            <div className="flex items-center gap-3">
              <CompanyLogo symbol={selected.symbol} logoUrl={selected.logoUrl} size="md" />
              <div>
                <p className="font-mono text-lg font-bold text-terminal-text">{selected.symbol}</p>
                <p className="text-sm text-terminal-textSecondary">{selected.name}</p>
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link to="/register" className={`min-h-11 flex-1 ${TERMINAL_LANDING_CTA_PRIMARY}`}>
                {t("landing.searchTeaser.unlockBrief")}
              </Link>
              <Link to="/login" className={`min-h-11 flex-1 ${TERMINAL_LANDING_CTA_SECONDARY}`}>
                {t("landing.searchTeaser.signInWatchlist")}
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
