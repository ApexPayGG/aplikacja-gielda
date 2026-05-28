import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { importCompanyFromSearch, searchCompaniesAutocomplete, type CompanySearchSuggestion } from "../services/api";
import { CompanyLogo } from "./CompanyLogo";
import { GLASS_INPUT } from "./behavioral-coach/glassStyles";
import {
  TERMINAL_BADGE,
  TERMINAL_INPUT,
  TERMINAL_SEARCH_DROPDOWN,
  TERMINAL_TEXT_MUTED,
} from "./terminal/terminalStyles";
import { colors } from "../styles/designSystem";

type CompanySearchAutocompleteProps = {
  placeholder?: string;
  initialValue?: string;
  limit?: number;
  navigateOnSelect?: boolean;
  compact?: boolean;
  /** `terminal` for authenticated shell; `glass` is a legacy alias for terminal. */
  variant?: "light" | "glass" | "terminal";
  onQueryChange?: (query: string) => void;
  onSelectCompany?: (company: CompanySearchSuggestion) => void;
};

const DEFAULT_LIMIT = 8;
const DEBOUNCE_MS = 300;

function isTerminalVariant(variant: CompanySearchAutocompleteProps["variant"]): boolean {
  return variant === "terminal" || variant === "glass";
}

export function CompanySearchAutocomplete({
  placeholder,
  initialValue = "",
  limit = DEFAULT_LIMIT,
  navigateOnSelect = true,
  compact = false,
  variant = "terminal",
  onQueryChange,
  onSelectCompany,
}: CompanySearchAutocompleteProps) {
  const { t } = useTranslation();
  const resolvedPlaceholder =
    placeholder ?? t("companySearch.placeholder", { defaultValue: "Search by symbol or name..." });
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState(initialValue);
  const [debouncedQuery, setDebouncedQuery] = useState(initialValue.trim());
  const [results, setResults] = useState<CompanySearchSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const terminal = isTerminalVariant(variant);

  useEffect(() => {
    setQuery(initialValue);
    setDebouncedQuery(initialValue.trim());
  }, [initialValue]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!debouncedQuery) {
        setResults([]);
        setLoading(false);
        setHighlightedIndex(-1);
        return;
      }
      setLoading(true);
      try {
        const rows = await searchCompaniesAutocomplete(debouncedQuery, limit);
        if (!active) return;
        setResults(rows);
        setHighlightedIndex(rows.length > 0 ? 0 : -1);
      } catch {
        if (!active) return;
        setResults([]);
        setHighlightedIndex(-1);
      } finally {
        if (active) setLoading(false);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [debouncedQuery, limit]);

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

  const showDropdown = isOpen && (loading || debouncedQuery.length > 0);

  const itemsToRender = useMemo(() => results.slice(0, Math.max(1, Math.min(20, limit))), [results, limit]);

  async function selectCompany(company: CompanySearchSuggestion): Promise<void> {
    setQuery(company.symbol);
    setIsOpen(false);
    onQueryChange?.(company.symbol);
    onSelectCompany?.(company);
    if (navigateOnSelect) {
      try {
        await importCompanyFromSearch(company.symbol, company.exchange);
      } catch {
        // Import is best-effort; navigate anyway to preserve UX.
      }
      navigate(`/company/${encodeURIComponent(company.symbol)}`);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setIsOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!showDropdown) setIsOpen(true);
      if (itemsToRender.length === 0) return;
      setHighlightedIndex((prev) => (prev + 1) % itemsToRender.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!showDropdown) setIsOpen(true);
      if (itemsToRender.length === 0) return;
      setHighlightedIndex((prev) => (prev <= 0 ? itemsToRender.length - 1 : prev - 1));
      return;
    }
    if (event.key === "Enter") {
      if (!showDropdown || highlightedIndex < 0 || highlightedIndex >= itemsToRender.length) return;
      event.preventDefault();
      void selectCompany(itemsToRender[highlightedIndex]!);
    }
  }

  const inputSizeClass = compact ? "h-10 pl-10 pr-3" : "h-12 pl-12 pr-4";
  const iconPositionClass = compact ? "left-3 h-4 w-4" : "left-4 h-5 w-5";

  return (
    <div ref={rootRef} className="relative w-full">
      <div className="relative">
        <MagnifyingGlassIcon
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-terminal-cyan ${iconPositionClass}`}
          aria-hidden
        />
        <input
          type="search"
          data-shortcut-search="true"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
            onQueryChange?.(event.target.value);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={resolvedPlaceholder}
          className={
            terminal
              ? `${TERMINAL_INPUT} shadow-sm ${inputSizeClass}`
              : variant === "glass"
                ? `${GLASS_INPUT} shadow-sm ${inputSizeClass}`
                : `w-full border shadow-sm outline-none transition ${
                    compact ? "h-10 rounded-xl pl-10 pr-3 text-sm" : "h-12 rounded-2xl pl-12 pr-4 text-sm"
                  }`
          }
          style={
            terminal || variant === "glass"
              ? undefined
              : {
                  borderColor: colors.border,
                  color: colors.textPrimary,
                  backgroundColor: colors.bgPrimary,
                }
          }
        />
      </div>

      {showDropdown ? (
        <div className={terminal || variant === "glass" ? TERMINAL_SEARCH_DROPDOWN : "absolute z-30 mt-2 w-full rounded-2xl border border-border bg-bgSecondary shadow-lg backdrop-blur-md"} role="listbox">
          {loading ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={`company-search-skeleton-${index}`} className="animate-pulse rounded-lg bg-terminal-panelSecondary p-3">
                  <div className="h-3 w-20 rounded bg-terminal-borderMuted" />
                  <div className="mt-2 h-3 w-40 rounded bg-terminal-borderMuted" />
                </div>
              ))}
            </div>
          ) : itemsToRender.length === 0 ? (
            <p className={`px-4 py-3 ${TERMINAL_TEXT_MUTED}`}>
              {t("companySearch.notFound", { defaultValue: "Company not found" })}
            </p>
          ) : (
            <ul className="max-h-80 overflow-auto py-1">
              {itemsToRender.map((company, index) => {
                const active = index === highlightedIndex;
                return (
                  <li key={`${company.symbol}-${company.exchange ?? "na"}-${index}`}>
                    <button
                      type="button"
                      className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left transition ${
                        terminal
                          ? active
                            ? "bg-terminal-panelSecondary"
                            : "bg-terminal-panel hover:bg-terminal-panelSecondary/80"
                          : active
                            ? "bg-bgSecondary"
                            : "bg-bgPrimary hover:bg-bgSecondary/80"
                      }`}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      onClick={() => void selectCompany(company)}
                    >
                      <CompanyLogo symbol={company.symbol} logoUrl={company.logoUrl} size="sm" shape="rounded" />
                      <div className="min-w-0 flex-1">
                        <p
                          className={`truncate text-sm font-bold ${terminal ? "text-terminal-cyan" : ""}`}
                          style={terminal ? undefined : { color: colors.brandDark }}
                        >
                          {company.symbol}
                        </p>
                        <p
                          className={`truncate text-sm ${terminal ? "text-terminal-textSecondary" : ""}`}
                          style={terminal ? undefined : { color: colors.textSecondary }}
                        >
                          {company.name}
                        </p>
                      </div>
                      <span className={terminal ? TERMINAL_BADGE : "shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold"} style={terminal ? undefined : { borderColor: colors.borderStrong, color: colors.textSecondary, backgroundColor: colors.bgSecondary }}>
                        {company.exchange ?? "N/A"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
