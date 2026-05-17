import { useEffect, useRef, useState } from "react";
import { colors } from "../styles/designSystem";
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
  onToggleSector,
  onMarketCapChange,
  onPeRangeChange,
  onDividendToggle,
  onSortChange,
  onReset,
}: Props) {
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
  const peFill = `linear-gradient(90deg, ${colors.border} 0%, ${colors.border} ${peMinPercent}%, ${colors.brandCyan} ${peMinPercent}%, ${colors.brandCyan} ${peMaxPercent}%, ${colors.border} ${peMaxPercent}%, ${colors.border} 100%)`;

  const selectedSectorLabel = filters.selectedSectors.length === 0 ? "All sectors" : `${filters.selectedSectors.length} selected`;

  return (
    <section className="space-y-6 rounded-2xl border p-4" style={{ borderColor: colors.border, backgroundColor: colors.bgSecondary }}>
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: colors.textSecondary }}>
          Filtry
        </h2>
        <button type="button" onClick={onReset} className="text-sm font-semibold hover:underline" style={{ color: colors.brandCyan }}>
          Resetuj filtry
        </button>
      </header>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.textSecondary }}>
          Sector
        </p>
        <div className="relative" ref={panelRef}>
          <button
            type="button"
            onClick={() => setIsSectorOpen((prev) => !prev)}
            className="w-full rounded-xl border px-3 py-2 text-left text-sm transition"
            style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary, color: colors.textPrimary }}
          >
            {selectedSectorLabel}
          </button>
          {isSectorOpen ? (
            <div
              className="absolute z-20 mt-2 max-h-64 w-full overflow-auto rounded-xl border p-2 shadow-lg"
              style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary }}
            >
              {COMPANY_FILTER_SECTORS.map((sector) => {
                const selected = filters.selectedSectors.includes(sector);
                return (
                  <label key={sector} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                    <input type="checkbox" checked={selected} onChange={() => onToggleSector(sector)} />
                    <span className="text-sm" style={{ color: colors.textPrimary }}>
                      {sector}
                    </span>
                  </label>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="market-cap-filter" className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.textSecondary }}>
          Market cap
        </label>
        <select
          id="market-cap-filter"
          value={filters.marketCap}
          onChange={(event) => onMarketCapChange(event.target.value as CompanyMarketCapFilter)}
          className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
          style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary, color: colors.textPrimary }}
        >
          {marketCapOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.textSecondary }}>
            P/E ratio
          </p>
          <span className="text-xs font-semibold" style={{ color: colors.brandDark }}>
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
          aria-label="Minimalny wskaźnik P/E"
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
          aria-label="Maksymalny wskaźnik P/E"
        />
      </div>

      <div className="flex items-center justify-between rounded-xl border px-3 py-2" style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary }}>
        <span className="text-sm font-medium" style={{ color: colors.textPrimary }}>
          Only dividend stocks
        </span>
        <button
          type="button"
          onClick={() => onDividendToggle(!filters.onlyDividendStocks)}
          className="relative inline-flex h-6 w-11 items-center rounded-full transition"
          style={{ backgroundColor: filters.onlyDividendStocks ? colors.brandCyan : colors.borderStrong }}
          aria-pressed={filters.onlyDividendStocks}
          aria-label="Only dividend stocks"
        >
          <span
            className="inline-block h-5 w-5 transform rounded-full bg-white shadow transition"
            style={{ transform: filters.onlyDividendStocks ? "translateX(22px)" : "translateX(2px)" }}
          />
        </button>
      </div>

      <div className="space-y-2">
        <label htmlFor="companies-sort-filter" className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.textSecondary }}>
          Sort
        </label>
        <select
          id="companies-sort-filter"
          value={filters.sortBy}
          onChange={(event) => onSortChange(event.target.value as CompanySortOption)}
          className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
          style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary, color: colors.textPrimary }}
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
