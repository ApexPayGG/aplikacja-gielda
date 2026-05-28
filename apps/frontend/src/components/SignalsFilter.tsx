import { useTranslation } from "react-i18next";
import {
  TERMINAL_FILTER_CHIP,
  TERMINAL_FILTER_CHIP_ACTIVE,
  TERMINAL_FILTER_PANEL,
  TERMINAL_INPUT,
  TERMINAL_LINK_ACCENT,
  TERMINAL_SECTION_TITLE,
} from "./terminal/terminalStyles";
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
  return active ? TERMINAL_FILTER_CHIP_ACTIVE : TERMINAL_FILTER_CHIP;
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
  const riskFill = `linear-gradient(90deg, #22d3ee 0%, #22d3ee ${filters.riskScoreMin}%, rgba(148,163,184,0.2) ${filters.riskScoreMin}%, rgba(148,163,184,0.2) 100%)`;

  return (
    <section className={TERMINAL_FILTER_PANEL}>
      <header className="flex items-center justify-between gap-2">
        <h2 className={TERMINAL_SECTION_TITLE}>{t("common.filters", { defaultValue: "Filters" })}</h2>
        <button type="button" onClick={onReset} className={`text-sm ${TERMINAL_LINK_ACCENT}`}>
          {t("common.resetFilters", { defaultValue: "Reset filters" })}
        </button>
      </header>

      <div className="space-y-2">
        <p className={TERMINAL_SECTION_TITLE}>Setup type</p>
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
          <p className={TERMINAL_SECTION_TITLE}>Risk score</p>
          <span className="text-xs font-semibold text-terminal-cyan">{filters.riskScoreMin} - 100</span>
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
        <p className={TERMINAL_SECTION_TITLE}>Exchange</p>
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
        <p className={TERMINAL_SECTION_TITLE}>Timeframe</p>
        <div className="grid grid-cols-2 gap-2">
          {timeframeOptions.map((option) => {
            const active = filters.timeframe === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onTimeframeChange(option.value)}
                className={`rounded-md border px-3 py-2 text-xs font-semibold transition ${
                  active
                    ? "border-terminal-cyan/40 bg-terminal-cyan/15 text-terminal-cyan"
                    : "border-terminal-borderMuted bg-terminal-panelSecondary/60 text-terminal-textSecondary hover:border-terminal-cyan/30"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="signals-sort-select" className={TERMINAL_SECTION_TITLE}>
          Sort by
        </label>
        <select
          id="signals-sort-select"
          value={filters.sortBy}
          onChange={(event) => onSortByChange(event.target.value as SignalSortOption)}
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
