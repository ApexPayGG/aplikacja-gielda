import { FormEvent, useMemo, useState } from "react";
import { runWalkForwardBacktestApi, type WalkForwardBacktestResponse, type WalkForwardStrategy } from "../services/api";
import {
  TERMINAL_BACKTEST_PANEL,
  TERMINAL_BUTTON_PRIMARY,
  TERMINAL_DANGER_PANEL,
  TERMINAL_FORM_LABEL,
  TERMINAL_INPUT,
  TERMINAL_INTELLIGENCE_CARD,
  TERMINAL_INTELLIGENCE_GRID,
  TERMINAL_INTELLIGENCE_PAGE,
  TERMINAL_INTELLIGENCE_PAGE_INNER,
  TERMINAL_INTELLIGENCE_PANEL,
  TERMINAL_PAGE_TITLE,
  TERMINAL_SCORE_TILE,
  TERMINAL_TABLE_HEAD,
  TERMINAL_TABLE_ROW,
} from "../components/terminal/terminalStyles";
import { apiErrorMessage } from "../utils/apiErrorMessage";

const CHART_CYAN = "#22d3ee";

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
    <div className={TERMINAL_INTELLIGENCE_PAGE}>
      <div className={`${TERMINAL_INTELLIGENCE_PAGE_INNER} max-w-7xl`}>
        <header className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terminal-cyan">Strategy lab</p>
          <h1 className={TERMINAL_PAGE_TITLE}>Walking Forward Backtest</h1>
          <p className="text-sm text-terminal-textMuted">
            Evaluate strategy robustness across rolling windows and inspect trade-level outcomes in one dashboard.
          </p>
        </header>

        <section className={TERMINAL_BACKTEST_PANEL}>
          <form className="grid gap-4 md:grid-cols-4" onSubmit={onSubmit}>
            <label className="text-sm md:col-span-1">
              <span className={`mb-1.5 block ${TERMINAL_FORM_LABEL}`}>Strategia</span>
              <select
                value={strategy}
                onChange={(event) => setStrategy(event.target.value as WalkForwardStrategy)}
                className={TERMINAL_INPUT}
              >
                {STRATEGY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm md:col-span-1">
              <span className={`mb-1.5 block ${TERMINAL_FORM_LABEL}`}>Okres</span>
              <select
                value={period}
                onChange={(event) => setPeriod(Number(event.target.value) as (typeof PERIOD_OPTIONS)[number])}
                className={TERMINAL_INPUT}
              >
                {PERIOD_OPTIONS.map((months) => (
                  <option key={months} value={months}>
                    {months} months
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm md:col-span-1">
              <span className={`mb-1.5 block ${TERMINAL_FORM_LABEL}`}>Symbol</span>
              <input
                value={symbol}
                onChange={(event) => setSymbol(event.target.value.toUpperCase())}
                className={TERMINAL_INPUT}
                maxLength={12}
              />
            </label>
            <div className="flex items-end md:col-span-1">
              <button type="submit" disabled={loading} className={`w-full ${TERMINAL_BUTTON_PRIMARY}`}>
                {loading ? "Running..." : "Run backtest"}
              </button>
            </div>
          </form>
        </section>

        {error ? <div className={TERMINAL_DANGER_PANEL}>{error}</div> : null}

        <section className={TERMINAL_INTELLIGENCE_PANEL}>
          <h2 className="mb-3 text-base font-semibold text-terminal-cyan">Equity curve (placeholder)</h2>
          <div className={TERMINAL_INTELLIGENCE_CARD}>
            <svg viewBox="0 0 100 42" className="h-48 w-full" preserveAspectRatio="none" role="img" aria-label="equity curve">
              <path d={`M0,42 L${linePath} L100,42`} fill={`${CHART_CYAN}18`} />
              <polyline points={linePath} fill="none" stroke={CHART_CYAN} strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </div>
        </section>

        <section className={TERMINAL_INTELLIGENCE_GRID}>
          <article className={TERMINAL_SCORE_TILE}>
            <div className="text-xs uppercase tracking-wide text-terminal-textMuted">Win rate</div>
            <div className="mt-2 text-2xl font-semibold text-terminal-text">
              {result ? `${result.winRate.toFixed(1)}%` : "62.5%"}
            </div>
          </article>
          <article className={TERMINAL_SCORE_TILE}>
            <div className="text-xs uppercase tracking-wide text-terminal-textMuted">Sharpe</div>
            <div className="mt-2 text-2xl font-semibold text-terminal-cyan">
              {result ? result.sharpeRatio.toFixed(2) : "1.34"}
            </div>
          </article>
          <article className={TERMINAL_SCORE_TILE}>
            <div className="text-xs uppercase tracking-wide text-terminal-textMuted">Max DD</div>
            <div className="mt-2 text-2xl font-semibold text-terminal-negative">
              {result ? `${result.maxDrawdown.toFixed(2)}%` : "-8.10%"}
            </div>
          </article>
          <article className={TERMINAL_SCORE_TILE}>
            <div className="text-xs uppercase tracking-wide text-terminal-textMuted">Total return</div>
            <div className={`mt-2 text-2xl font-semibold ${totalReturn >= 0 ? "text-terminal-positive" : "text-terminal-negative"}`}>
              {totalReturn >= 0 ? "+" : ""}
              {totalReturn.toFixed(2)}%
            </div>
          </article>
        </section>

        <section className={TERMINAL_INTELLIGENCE_PANEL}>
          <h2 className="mb-3 text-base font-semibold text-terminal-cyan">Trade list</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className={TERMINAL_TABLE_HEAD}>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Action</th>
                  <th className="py-2 pr-4">Price</th>
                  <th className="py-2">P&amp;L</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((trade, index) => (
                  <tr key={`${trade.date}-${index}`} className={TERMINAL_TABLE_ROW}>
                    <td className="py-3 pr-4 font-mono text-terminal-textMuted">{trade.date}</td>
                    <td className="py-3 pr-4 font-medium text-terminal-cyan">{trade.action}</td>
                    <td className="py-3 pr-4 font-mono text-terminal-textSecondary">{trade.price.toFixed(2)}</td>
                    <td className={`py-3 font-mono font-semibold ${trade.outcome >= 0 ? "text-terminal-positive" : "text-terminal-negative"}`}>
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
    </div>
  );
}
