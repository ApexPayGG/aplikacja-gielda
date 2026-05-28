import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  TERMINAL_DROPDOWN_PANEL,
  TERMINAL_FILTER_PANEL,
  TERMINAL_INPUT,
  TERMINAL_LINK_ACCENT,
  TERMINAL_PANEL_MUTED,
  TERMINAL_SECTION_TITLE,
} from "./terminal/terminalStyles";
import {
  COMPANY_FILTER_SECTORS,
  PE_RATIO_MAX,
  PE_RATIO_MIN,
  type CompaniesFilterState,
  type CompanyFilterSector,
  type CompanyMarketCapFilter,
  type CompanySortOption,
} from "../hooks/useCompaniesFilter";

type Props = {
  filters: CompaniesFilterState;
  dividendFilterLoading?: boolean;
  onToggleSector: (sector: CompanyFilterSector) => void;
  onMarketCapChange: (value: CompanyMarketCapFilter) => void;
  onPeRangeChange: (min: number, max: number) => void;
  onDividendToggle: (value: boolean) => void;
  onSortChange: (value: CompanySortOption) => void;
  onReset: () => void;
};

const marketCapOptions: Array<{ value: CompanyMarketCapFilter; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "UNDER_1B", label: "<1B" },
  { value: "1B_10B", label: "1B-10B" },
  { value: "10B_100B", label: "10B-100B" },
  { value: "OVER_100B", label: ">100B" },
];

const sortOptions: Array<{ value: CompanySortOption; label: string }> = [
  { value: "NAME", label: "Name" },
  { value: "MARKET_CAP", label: "Market Cap" },
  { value: "PRICE_CHANGE", label: "Price Change %" },
];

export function CompaniesFilter({
  filters,
  dividendFilterLoading = false,
  onToggleSector,
  onMarketCapChange,
  onPeRangeChange,
  onDividendToggle,
  onSortChange,
  onReset,
}: Props) {
  const { t } = useTranslation();
  const [isSectorOpen, setIsSectorOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onOutsideClick(event: MouseEvent): void {
      if (!panelRef.current?.contains(event.target as Node)) {
        setIsSectorOpen(false);
      }
    }

    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, []);

  const peMinPercent = ((filters.peMin - PE_RATIO_MIN) / (PE_RATIO_MAX - PE_RATIO_MIN)) * 100;
  const peMaxPercent = ((filters.peMax - PE_RATIO_MIN) / (PE_RATIO_MAX - PE_RATIO_MIN)) * 100;
  const peFill = `linear-gradient(90deg, rgba(148,163,184,0.2) 0%, rgba(148,163,184,0.2) ${peMinPercent}%, #22d3ee ${peMinPercent}%, #22d3ee ${peMaxPercent}%, rgba(148,163,184,0.2) ${peMaxPercent}%, rgba(148,163,184,0.2) 100%)`;

  const selectedSectorLabel = filters.selectedSectors.length === 0 ? "All sectors" : `${filters.selectedSectors.length} selected`;

  return (
    <section className={TERMINAL_FILTER_PANEL}>
      <header className="flex items-center justify-between gap-2">
        <h2 className={TERMINAL_SECTION_TITLE}>{t("common.filters", { defaultValue: "Filters" })}</h2>
        <button type="button" onClick={onReset} className={`text-sm ${TERMINAL_LINK_ACCENT}`}>
          {t("common.resetFilters", { defaultValue: "Reset filters" })}
        </button>
      </header>

      <div className="space-y-2">
        <p className={TERMINAL_SECTION_TITLE}>Sector</p>
        <div className="relative" ref={panelRef}>
          <button type="button" onClick={() => setIsSectorOpen((prev) => !prev)} className={`${TERMINAL_INPUT} text-left`}>
            {selectedSectorLabel}
          </button>
          {isSectorOpen ? (
            <div className={`absolute z-20 mt-2 max-h-64 w-full overflow-auto p-2 ${TERMINAL_DROPDOWN_PANEL}`}>
              {COMPANY_FILTER_SECTORS.map((sector) => {
                const selected = filters.selectedSectors.includes(sector);
                return (
                  <label
                    key={sector}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-terminal-panelSecondary"
                  >
                    <input type="checkbox" checked={selected} onChange={() => onToggleSector(sector)} className="accent-terminal-cyan" />
                    <span className="text-sm text-terminal-text">{sector}</span>
                  </label>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="market-cap-filter" className={TERMINAL_SECTION_TITLE}>
          Market cap
        </label>
        <select
          id="market-cap-filter"
          value={filters.marketCap}
          onChange={(event) => onMarketCapChange(event.target.value as CompanyMarketCapFilter)}
          className={TERMINAL_INPUT}
        >
          {marketCapOptions.map((option) => (
            <option key={option.value} value={option.value} className="bg-terminal-panel text-terminal-text">
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className={TERMINAL_SECTION_TITLE}>P/E ratio</p>
          <span className="text-xs font-semibold text-terminal-cyan">
            {filters.peMin} - {filters.peMax}
          </span>
        </div>

        <input
          type="range"
          min={PE_RATIO_MIN}
          max={PE_RATIO_MAX}
          step={1}
          value={filters.peMin}
          onChange={(event) => onPeRangeChange(Number(event.target.value), filters.peMax)}
          className="h-2 w-full cursor-pointer appearance-none rounded-full"
          style={{ background: peFill }}
          aria-label={t("companies.peMinAria", { defaultValue: "Minimum P/E ratio" })}
        />
        <input
          type="range"
          min={PE_RATIO_MIN}
          max={PE_RATIO_MAX}
          step={1}
          value={filters.peMax}
          onChange={(event) => onPeRangeChange(filters.peMin, Number(event.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-full"
          style={{ background: peFill }}
          aria-label={t("companies.peMaxAria", { defaultValue: "Maximum P/E ratio" })}
        />
      </div>

      <div className={`flex items-center justify-between rounded-lg border border-terminal-borderMuted px-3 py-2 ${TERMINAL_PANEL_MUTED}`}>
        <span className="text-sm font-medium text-terminal-text">
          {t("companies.filterDividend", { defaultValue: "Dividend stocks only" })}
          {dividendFilterLoading ? <span className="ml-1 text-xs font-normal text-terminal-textMuted">…</span> : null}
        </span>
        <button
          type="button"
          onClick={() => onDividendToggle(!filters.onlyDividendStocks)}
          disabled={dividendFilterLoading}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition disabled:opacity-60 ${
            filters.onlyDividendStocks ? "bg-terminal-cyan" : "bg-terminal-borderMuted"
          }`}
          aria-pressed={filters.onlyDividendStocks}
          aria-label={t("companies.filterDividend", { defaultValue: "Dividend stocks only" })}
        >
          <span
            className="inline-block h-5 w-5 transform rounded-full bg-terminal-text shadow transition"
            style={{ transform: filters.onlyDividendStocks ? "translateX(22px)" : "translateX(2px)" }}
          />
        </button>
      </div>

      <div className="space-y-2">
        <label htmlFor="companies-sort-filter" className={TERMINAL_SECTION_TITLE}>
          Sort
        </label>
        <select
          id="companies-sort-filter"
          value={filters.sortBy}
          onChange={(event) => onSortChange(event.target.value as CompanySortOption)}
          className={TERMINAL_INPUT}
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value} className="bg-terminal-panel text-terminal-text">
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
