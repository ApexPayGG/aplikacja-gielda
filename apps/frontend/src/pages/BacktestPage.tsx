import { FormEvent, useMemo, useState } from "react";
import { runWalkForwardBacktestApi, type WalkForwardBacktestResponse, type WalkForwardStrategy } from "../services/api";
import { colors } from "../styles/designSystem";
import { apiErrorMessage } from "../utils/apiErrorMessage";

const PERIOD_OPTIONS = [3, 6, 12] as const;
const STRATEGY_OPTIONS: Array<{ value: WalkForwardStrategy; label: string }> = [
  { value: "RSI_OVERSOLD", label: "RSI Oversold" },
  { value: "BREAKOUT", label: "Breakout" },
  { value: "VOLUME_SPIKE", label: "Volume Spike" },
];

const PLACEHOLDER_EQUITY = [100, 103, 101, 108, 112, 115, 113, 119, 122, 126];
const PLACEHOLDER_TRADES = [
  { date: "2026-01-12", action: "BUY", price: 124.5, outcome: 2.4 },
  { date: "2026-02-03", action: "SELL", price: 129.1, outcome: -1.1 },
  { date: "2026-03-18", action: "BUY", price: 121.8, outcome: 3.2 },
  { date: "2026-04-04", action: "SELL", price: 130.7, outcome: 1.7 },
];

function buildLinePath(values: number[], width: number, height: number): string {
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);

  return values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

export function BacktestPage() {
  const [symbol, setSymbol] = useState("AAPL");
  const [strategy, setStrategy] = useState<WalkForwardStrategy>("RSI_OVERSOLD");
  const [period, setPeriod] = useState<(typeof PERIOD_OPTIONS)[number]>(6);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WalkForwardBacktestResponse | null>(null);

  const equityValues = useMemo(() => {
    if (result?.equity.length) return result.equity.map((point) => point.value);
    return PLACEHOLDER_EQUITY;
  }, [result]);

  const totalReturn = useMemo(() => {
    if (equityValues.length < 2) return 0;
    const first = equityValues[0];
    const last = equityValues[equityValues.length - 1];
    if (first === 0) return 0;
    return ((last - first) / first) * 100;
  }, [equityValues]);

  const linePath = useMemo(() => buildLinePath(equityValues, 100, 42), [equityValues]);
  const trades = result?.trades.length ? result.trades : PLACEHOLDER_TRADES;

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const normalizedSymbol = symbol.trim().toUpperCase();
    if (!normalizedSymbol) {
      setError("Symbol is required.");
      setResult(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await runWalkForwardBacktestApi({
        symbol: normalizedSymbol,
        strategy,
        months: period,
      });
      setResult(response);
    } catch (e) {
      setResult(null);
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-10" style={{ color: colors.textPrimary }}>
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: colors.brandDark }}>
          Walking Forward Backtest
        </h1>
        <p className="text-sm" style={{ color: colors.textSecondary }}>
          Evaluate strategy robustness across rolling windows and inspect trade-level outcomes in one AMC-style dashboard.
        </p>
      </header>

      <section className="rounded-2xl border p-5 glass-section">
        <form className="grid gap-4 md:grid-cols-4" onSubmit={onSubmit}>
          <label className="text-sm md:col-span-1">
            <span className="mb-1.5 block font-medium" style={{ color: colors.textSecondary }}>
              Strategia
            </span>
            <select
              value={strategy}
              onChange={(event) => setStrategy(event.target.value as WalkForwardStrategy)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
              style={{ borderColor: colors.borderStrong, backgroundColor: colors.bgSecondary }}
            >
              {STRATEGY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm md:col-span-1">
            <span className="mb-1.5 block font-medium" style={{ color: colors.textSecondary }}>
              Okres
            </span>
            <select
              value={period}
              onChange={(event) => setPeriod(Number(event.target.value) as (typeof PERIOD_OPTIONS)[number])}
              className="w-full rounded-xl border px-3 py-2 outline-none"
              style={{ borderColor: colors.borderStrong, backgroundColor: colors.bgSecondary }}
            >
              {PERIOD_OPTIONS.map((months) => (
                <option key={months} value={months}>
                  {months} months
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm md:col-span-1">
            <span className="mb-1.5 block font-medium" style={{ color: colors.textSecondary }}>
              Symbol
            </span>
            <input
              value={symbol}
              onChange={(event) => setSymbol(event.target.value.toUpperCase())}
              className="w-full rounded-xl border px-3 py-2 outline-none"
              style={{ borderColor: colors.borderStrong, backgroundColor: colors.bgSecondary }}
              maxLength={12}
            />
          </label>
          <div className="flex items-end md:col-span-1">
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: colors.brandDark }}
            >
              {loading ? "Running..." : "Run backtest"}
            </button>
          </div>
        </form>
      </section>

      {error ? (
        <div
          className="rounded-xl border px-4 py-3 text-sm"
          style={{ borderColor: `${colors.negative}55`, backgroundColor: `${colors.negative}10`, color: colors.negative }}
        >
          {error}
        </div>
      ) : null}

      <section className="rounded-2xl border p-5 glass-section">
        <h2 className="mb-3 text-base font-semibold" style={{ color: colors.brandDark }}>
          Equity curve (placeholder)
        </h2>
        <div className="rounded-xl border p-4 glass-panel">
          <svg viewBox="0 0 100 42" className="h-48 w-full" preserveAspectRatio="none" role="img" aria-label="equity curve">
            <path d={`M0,42 L${linePath} L100,42`} fill={`${colors.brandCyan}18`} />
            <polyline points={linePath} fill="none" stroke={colors.brandCyan} strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <article className="rounded-xl border p-4 glass-section">
          <div className="text-xs uppercase tracking-wide" style={{ color: colors.textMuted }}>
            Win rate
          </div>
          <div className="mt-2 text-2xl font-semibold" style={{ color: colors.brandDark }}>
            {result ? `${result.winRate.toFixed(1)}%` : "62.5%"}
          </div>
        </article>
        <article className="rounded-xl border p-4 glass-section">
          <div className="text-xs uppercase tracking-wide" style={{ color: colors.textMuted }}>
            Sharpe
          </div>
          <div className="mt-2 text-2xl font-semibold" style={{ color: colors.brandDark }}>
            {result ? result.sharpeRatio.toFixed(2) : "1.34"}
          </div>
        </article>
        <article className="rounded-xl border p-4 glass-section">
          <div className="text-xs uppercase tracking-wide" style={{ color: colors.textMuted }}>
            Max DD
          </div>
          <div className="mt-2 text-2xl font-semibold" style={{ color: colors.negative }}>
            {result ? `${result.maxDrawdown.toFixed(2)}%` : "-8.10%"}
          </div>
        </article>
        <article className="rounded-xl border p-4 glass-section">
          <div className="text-xs uppercase tracking-wide" style={{ color: colors.textMuted }}>
            Total return
          </div>
          <div className="mt-2 text-2xl font-semibold" style={{ color: totalReturn >= 0 ? colors.positive : colors.negative }}>
            {totalReturn >= 0 ? "+" : ""}
            {totalReturn.toFixed(2)}%
          </div>
        </article>
      </section>

      <section className="rounded-2xl border p-5 glass-section">
        <h2 className="mb-3 text-base font-semibold" style={{ color: colors.brandDark }}>
          Trade list
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: colors.border }}>
                <th className="py-2 pr-4 text-xs uppercase" style={{ color: colors.textMuted }}>
                  Date
                </th>
                <th className="py-2 pr-4 text-xs uppercase" style={{ color: colors.textMuted }}>
                  Action
                </th>
                <th className="py-2 pr-4 text-xs uppercase" style={{ color: colors.textMuted }}>
                  Price
                </th>
                <th className="py-2 text-xs uppercase" style={{ color: colors.textMuted }}>
                  P&amp;L
                </th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade, index) => (
                <tr key={`${trade.date}-${index}`} className="border-b last:border-b-0" style={{ borderColor: colors.border }}>
                  <td className="py-3 pr-4 font-mono" style={{ color: colors.textSecondary }}>
                    {trade.date}
                  </td>
                  <td className="py-3 pr-4 font-medium" style={{ color: colors.brandDark }}>
                    {trade.action}
                  </td>
                  <td className="py-3 pr-4 font-mono" style={{ color: colors.textSecondary }}>
                    {trade.price.toFixed(2)}
                  </td>
                  <td className="py-3 font-mono font-semibold" style={{ color: trade.outcome >= 0 ? colors.positive : colors.negative }}>
                    {trade.outcome >= 0 ? "+" : ""}
                    {trade.outcome.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
