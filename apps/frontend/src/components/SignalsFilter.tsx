import { useTranslation } from "react-i18next";
import {
  GLASS_FILTER_PANEL,
  GLASS_LABEL,
  GLASS_LINK_ACCENT,
  GLASS_SELECT,
} from "./behavioral-coach/glassStyles";
import {
  SIGNAL_EXCHANGES,
  SIGNAL_SETUP_TYPES,
  type SignalExchange,
  type SignalSetupType,
  type SignalSortOption,
  type SignalsFilterState,
  type SignalsTimeframe,
} from "../hooks/useSignalsFilter";

type Props = {
  filters: SignalsFilterState;
  onToggleSetupType: (setupType: SignalSetupType) => void;
  onRiskScoreChange: (value: number) => void;
  onToggleExchange: (exchange: SignalExchange) => void;
  onTimeframeChange: (timeframe: SignalsTimeframe) => void;
  onSortByChange: (sortBy: SignalSortOption) => void;
  onReset: () => void;
};

const timeframeOptions: Array<{ value: SignalsTimeframe; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "TODAY", label: "Today" },
  { value: "THIS_WEEK", label: "This Week" },
  { value: "THIS_MONTH", label: "This Month" },
];

const sortOptions: Array<{ value: SignalSortOption; label: string }> = [
  { value: "SCORE_DESC", label: "Score ↓" },
  { value: "SCORE_ASC", label: "Score ↑" },
  { value: "NEWEST", label: "Newest" },
  { value: "OLDEST", label: "Oldest" },
];

function pillClass(active: boolean): string {
  return active
    ? "rounded-full border border-[#22d3ee]/50 bg-[#22d3ee]/20 px-3 py-1.5 text-xs font-semibold text-[#22d3ee]"
    : "rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:border-white/25";
}

export function SignalsFilter({
  filters,
  onToggleSetupType,
  onRiskScoreChange,
  onToggleExchange,
  onTimeframeChange,
  onSortByChange,
  onReset,
}: Props) {
  const { t } = useTranslation();
  const riskFill = `linear-gradient(90deg, #22d3ee 0%, #22d3ee ${filters.riskScoreMin}%, rgba(255,255,255,0.12) ${filters.riskScoreMin}%, rgba(255,255,255,0.12) 100%)`;

  return (
    <section className={GLASS_FILTER_PANEL}>
      <header className="flex items-center justify-between gap-2">
        <h2 className={GLASS_LABEL}>{t("common.filters", { defaultValue: "Filters" })}</h2>
        <button type="button" onClick={onReset} className={`text-sm ${GLASS_LINK_ACCENT}`}>
          {t("common.resetFilters", { defaultValue: "Reset filters" })}
        </button>
      </header>

      <div className="space-y-2">
        <p className={GLASS_LABEL}>Setup type</p>
        <div className="flex flex-wrap gap-2">
          {SIGNAL_SETUP_TYPES.map((setupType) => {
            const active = filters.selectedSetupTypes.includes(setupType);
            return (
              <button key={setupType} type="button" onClick={() => onToggleSetupType(setupType)} className={pillClass(active)}>
                {setupType}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className={GLASS_LABEL}>Risk score</p>
          <span className="text-xs font-semibold text-[#22d3ee]">{filters.riskScoreMin} - 100</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={filters.riskScoreMin}
          onChange={(event) => onRiskScoreChange(Number(event.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-full"
          style={{ background: riskFill }}
          aria-label="Minimalny score ryzyka"
        />
      </div>

      <div className="space-y-2">
        <p className={GLASS_LABEL}>Exchange</p>
        <div className="flex flex-wrap gap-2">
          {SIGNAL_EXCHANGES.map((exchange) => {
            const active = filters.selectedExchanges.includes(exchange);
            return (
              <button key={exchange} type="button" onClick={() => onToggleExchange(exchange)} className={pillClass(active)}>
                {exchange}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <p className={GLASS_LABEL}>Timeframe</p>
        <div className="grid grid-cols-2 gap-2">
          {timeframeOptions.map((option) => {
            const active = filters.timeframe === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onTimeframeChange(option.value)}
                className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  active
                    ? "border-[#22d3ee]/40 bg-[#22d3ee]/15 text-[#22d3ee]"
                    : "border-white/15 bg-white/5 text-white/70 hover:border-white/25"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="signals-sort-select" className={GLASS_LABEL}>
          Sort by
        </label>
        <select
          id="signals-sort-select"
          value={filters.sortBy}
          onChange={(event) => onSortByChange(event.target.value as SignalSortOption)}
          className={GLASS_SELECT}
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value} className="bg-[#0f111c] text-white">
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
