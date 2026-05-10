import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  runWalkForwardBacktestApi,
  type WalkForwardBacktestResponse,
  type WalkForwardStrategy,
} from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";

const MONTH_OPTIONS = [3, 6, 12] as const;

export function WalkForwardPage() {
  const { t } = useTranslation();
  const [symbol, setSymbol] = useState("AAPL");
  const [strategy, setStrategy] = useState<WalkForwardStrategy>("RSI_OVERSOLD");
  const [months, setMonths] = useState<(typeof MONTH_OPTIONS)[number]>(6);
  const [result, setResult] = useState<WalkForwardBacktestResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strategyLabel = useMemo(() => {
    if (strategy === "RSI_OVERSOLD") return t("backtest.strategyRsi");
    if (strategy === "BREAKOUT") return t("backtest.strategyBreakout");
    return t("backtest.strategyVolume");
  }, [strategy, t]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await runWalkForwardBacktestApi({
        symbol: symbol.trim().toUpperCase(),
        strategy,
        months,
      });
      setResult(data);
    } catch (e) {
      setResult(null);
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-brand-bg text-slate-100">
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        <header>
          <h1 className="text-2xl font-bold text-white">{t("backtest.title")}</h1>
          <p className="mt-1 text-sm text-slate-400">{t("backtest.subtitle")}</p>
        </header>

        {error ? (
          <div className="rounded border border-brand-red/30 bg-brand-red/10 p-3 text-sm text-brand-red">
            {error}
          </div>
        ) : null}

        <section className="neo-panel rounded-xl p-4">
          <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-4">
            <label className="flex flex-col gap-1 text-sm md:col-span-1">
              <span className="text-slate-400">{t("backtest.symbol")}</span>
              <input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="rounded border border-brand-border bg-brand-bg px-3 py-2 uppercase text-white"
                maxLength={16}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm md:col-span-1">
              <span className="text-slate-400">{t("backtest.strategy")}</span>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as WalkForwardStrategy)}
                className="rounded border border-brand-border bg-brand-bg px-3 py-2 text-white"
              >
                <option value="RSI_OVERSOLD">{t("backtest.strategyRsi")}</option>
                <option value="BREAKOUT">{t("backtest.strategyBreakout")}</option>
                <option value="VOLUME_SPIKE">{t("backtest.strategyVolume")}</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm md:col-span-1">
              <span className="text-slate-400">{t("backtest.period")}</span>
              <select
                value={months}
                onChange={(e) => setMonths(Number(e.target.value) as (typeof MONTH_OPTIONS)[number])}
                className="rounded border border-brand-border bg-brand-bg px-3 py-2 text-white"
              >
                <option value={3}>{t("backtest.months3")}</option>
                <option value={6}>{t("backtest.months6")}</option>
                <option value={12}>{t("backtest.months12")}</option>
              </select>
            </label>
            <div className="flex items-end md:col-span-1">
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue/85 disabled:opacity-60"
              >
                {loading ? t("common.loading") : t("backtest.runButton")}
              </button>
            </div>
          </form>
        </section>

        {result ? (
          <>
            <section className="neo-panel rounded-xl p-4">
              <h2 className="mb-3 text-lg font-semibold text-white">{t("backtest.resultsTitle")}</h2>
              <p className="mb-4 text-xs text-slate-500">
                {result.symbol} · {strategyLabel} · {result.months} {t("backtest.monthsSuffix")}
              </p>
              <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
                <div>
                  <dt className="text-slate-400">{t("backtest.winRate")}</dt>
                  <dd className="font-mono text-white">{result.winRate.toFixed(2)}%</dd>
                </div>
                <div>
                  <dt className="text-slate-400">{t("backtest.avgReturn")}</dt>
                  <dd className="font-mono text-white">{result.avgReturn.toFixed(2)}%</dd>
                </div>
                <div>
                  <dt className="text-slate-400">{t("backtest.totalTrades")}</dt>
                  <dd className="font-mono text-white">{result.totalTrades}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">{t("backtest.maxDrawdown")}</dt>
                  <dd className="font-mono text-white">{result.maxDrawdown.toFixed(2)}%</dd>
                </div>
                <div>
                  <dt className="text-slate-400">{t("backtest.sharpeRatio")}</dt>
                  <dd className="font-mono text-white">{result.sharpeRatio.toFixed(4)}</dd>
                </div>
              </dl>
            </section>

            <section className="neo-panel rounded-xl p-4">
              <h2 className="mb-3 text-lg font-semibold text-white">{t("backtest.tradesTableTitle")}</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-brand-border text-slate-400">
                      <th className="py-2 pr-3 font-medium">{t("backtest.colDate")}</th>
                      <th className="py-2 pr-3 font-medium">{t("backtest.colAction")}</th>
                      <th className="py-2 pr-3 font-medium">{t("backtest.colPrice")}</th>
                      <th className="py-2 font-medium">{t("backtest.colOutcome")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.trades.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-slate-500">
                          {t("common.noData")}
                        </td>
                      </tr>
                    ) : (
                      result.trades.map((row, i) => (
                        <tr key={`${row.date}-${i}`} className="border-b border-brand-border/60">
                          <td className="py-2 pr-3 font-mono text-slate-200">{row.date}</td>
                          <td className="py-2 pr-3 text-slate-200">{row.action}</td>
                          <td className="py-2 pr-3 font-mono text-slate-200">{row.price.toFixed(2)}</td>
                          <td
                            className={`py-2 font-mono ${row.outcome >= 0 ? "text-emerald-400" : "text-brand-red"}`}
                          >
                            {row.outcome >= 0 ? "+" : ""}
                            {row.outcome.toFixed(2)}%
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
