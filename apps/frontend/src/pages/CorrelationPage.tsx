import { useState } from "react";
import { useTranslation } from "react-i18next";
import { analyzeCorrelation, type CorrelationAnalyzeResponse } from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";

function rowColor(value: number): string {
  if (value < 0.3) return "text-emerald-300";
  if (value <= 0.7) return "text-amber-300";
  return "text-red-300";
}

function parsePortfolioInput(raw: string): string[] {
  return raw
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter((item) => item.length > 0);
}

export function CorrelationPage() {
  const { t } = useTranslation();
  const [symbolInput, setSymbolInput] = useState("AAPL");
  const [portfolioInput, setPortfolioInput] = useState("MSFT, NVDA, TSLA");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CorrelationAnalyzeResponse | null>(null);

  async function onSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    const symbol = symbolInput.trim().toUpperCase();
    const portfolio = parsePortfolioInput(portfolioInput);
    if (!symbol || portfolio.length === 0) {
      setError(t("correlation.validation"));
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await analyzeCorrelation({ symbol, portfolio });
      setData(response);
    } catch (e) {
      setData(null);
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-white">{t("correlation.title")}</h1>
        <p className="mt-1 text-sm text-slate-400">{t("correlation.subtitle")}</p>
      </header>

      <form onSubmit={onSubmit} className="neo-panel rounded-xl p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-slate-400">{t("correlation.mainSymbol")}</span>
            <input
              value={symbolInput}
              onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
              placeholder="AAPL"
              className="w-full rounded border border-brand-border bg-brand-bg px-3 py-2 text-white outline-none focus:border-brand-blue"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-400">{t("correlation.portfolioSymbols")}</span>
            <input
              value={portfolioInput}
              onChange={(e) => setPortfolioInput(e.target.value.toUpperCase())}
              placeholder="MSFT, NVDA, TSLA"
              className="w-full rounded border border-brand-border bg-brand-bg px-3 py-2 text-white outline-none focus:border-brand-blue"
            />
          </label>
        </div>
        <div className="mt-4">
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue/85 disabled:opacity-60"
          >
            {loading ? t("common.loading") : t("correlation.analyze")}
          </button>
        </div>
      </form>

      {error ? (
        <div className="mt-4 rounded border border-brand-red/30 bg-brand-red/10 p-3 text-sm text-brand-red">{error}</div>
      ) : null}

      {data ? (
        <section className="mt-6 space-y-4">
          <div className="neo-panel overflow-x-auto rounded-xl p-4">
            <h2 className="mb-3 text-lg font-semibold text-white">{t("correlation.tableTitle")}</h2>
            <table className="w-full min-w-[460px] text-left text-sm">
              <thead>
                <tr className="border-b border-brand-border text-xs uppercase text-slate-500">
                  <th className="py-2 pr-4">{t("correlation.colSymbol")}</th>
                  <th className="py-2 pr-4">{t("correlation.colCorrelation")}</th>
                  <th className="py-2">{t("correlation.colWarning")}</th>
                </tr>
              </thead>
              <tbody>
                {data.correlations.map((row) => (
                  <tr key={row.symbol} className="border-b border-white/5">
                    <td className="py-2 pr-4 font-semibold text-white">{row.symbol}</td>
                    <td className={`py-2 pr-4 font-mono ${rowColor(row.correlation)}`}>{row.correlation.toFixed(4)}</td>
                    <td className="py-2">
                      {row.warning ? (
                        <span className="rounded-full border border-red-500/50 bg-red-500/15 px-2 py-0.5 text-xs text-red-200">
                          {t("correlation.warningHighRisk")}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">{t("correlation.warningLowRisk")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="neo-panel rounded-xl p-4">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
              {t("correlation.highRiskPairs")}
            </h3>
            {data.highRiskPairs.length > 0 ? (
              <ul className="space-y-1 text-sm text-slate-200">
                {data.highRiskPairs.map((pair) => (
                  <li key={`${pair.a}-${pair.b}`}>
                    {pair.a} / {pair.b}: <span className="font-mono text-red-300">{pair.correlation.toFixed(4)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">{t("correlation.noHighRiskPairs")}</p>
            )}
          </div>

          <div className="neo-panel rounded-xl border border-brand-blue/30 bg-brand-blue/10 p-4">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">{t("correlation.aiInsight")}</h3>
            <p className="text-slate-100">{data.insight}</p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
