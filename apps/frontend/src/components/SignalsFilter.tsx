import { colors } from "../styles/designSystem";
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

export function SignalsFilter({
  filters,
  onToggleSetupType,
  onRiskScoreChange,
  onToggleExchange,
  onTimeframeChange,
  onSortByChange,
  onReset,
}: Props) {
  const riskFill = `linear-gradient(90deg, ${colors.brandCyan} 0%, ${colors.brandCyan} ${filters.riskScoreMin}%, ${colors.border} ${filters.riskScoreMin}%, ${colors.border} 100%)`;

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
          Setup type
        </p>
        <div className="flex flex-wrap gap-2">
          {SIGNAL_SETUP_TYPES.map((setupType) => {
            const active = filters.selectedSetupTypes.includes(setupType);
            return (
              <button
                key={setupType}
                type="button"
                onClick={() => onToggleSetupType(setupType)}
                className="rounded-full border px-3 py-1.5 text-xs font-semibold transition"
                style={{
                  borderColor: active ? colors.brandDark : colors.borderStrong,
                  backgroundColor: active ? colors.brandDark : colors.bgPrimary,
                  color: active ? colors.bgPrimary : colors.textSecondary,
                }}
              >
                {setupType}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.textSecondary }}>
            Risk score
          </p>
          <span className="text-xs font-semibold" style={{ color: colors.brandDark }}>
            {filters.riskScoreMin} - 100
          </span>
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
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.textSecondary }}>
          Exchange
        </p>
        <div className="flex flex-wrap gap-2">
          {SIGNAL_EXCHANGES.map((exchange) => {
            const active = filters.selectedExchanges.includes(exchange);
            return (
              <button
                key={exchange}
                type="button"
                onClick={() => onToggleExchange(exchange)}
                className="rounded-full border px-3 py-1.5 text-xs font-semibold transition"
                style={{
                  borderColor: active ? colors.brandDark : colors.borderStrong,
                  backgroundColor: active ? colors.brandDark : colors.bgPrimary,
                  color: active ? colors.bgPrimary : colors.textSecondary,
                }}
              >
                {exchange}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.textSecondary }}>
          Timeframe
        </p>
        <div className="grid grid-cols-2 gap-2">
          {timeframeOptions.map((option) => {
            const active = filters.timeframe === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onTimeframeChange(option.value)}
                className="rounded-xl border px-3 py-2 text-xs font-semibold transition"
                style={{
                  borderColor: active ? colors.brandCyan : colors.border,
                  backgroundColor: active ? `${colors.brandCyan}22` : colors.bgPrimary,
                  color: active ? colors.brandDark : colors.textSecondary,
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="signals-sort-select" className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.textSecondary }}>
          Sort by
        </label>
        <select
          id="signals-sort-select"
          value={filters.sortBy}
          onChange={(event) => onSortByChange(event.target.value as SignalSortOption)}
          className="w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
          style={{
            borderColor: colors.border,
            backgroundColor: colors.bgPrimary,
            color: colors.textPrimary,
          }}
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
