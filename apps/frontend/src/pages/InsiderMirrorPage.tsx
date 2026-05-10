import { FormEvent, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getInsiderMirror,
  type InsiderAction,
  type InsiderMirrorResponse,
  type InsiderSentiment,
} from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";

function sentimentClasses(sentiment: InsiderSentiment): string {
  if (sentiment === "BUY") return "bg-brand-green/20 text-brand-green border-brand-green/40";
  if (sentiment === "SELL") return "bg-brand-red/20 text-brand-red border-brand-red/40";
  return "bg-slate-500/20 text-slate-200 border-slate-500/40";
}

function actionClasses(action: InsiderAction): string {
  if (action === "BUY") return "text-brand-green";
  return "text-brand-red";
}

function formatUsd(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

export function InsiderMirrorPage() {
  const { t } = useTranslation();
  const [symbolInput, setSymbolInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InsiderMirrorResponse | null>(null);

  const sentimentLabel = useMemo(() => {
    if (!result) return "";
    if (result.netSentiment === "BUY") return t("insider.sentimentBuy");
    if (result.netSentiment === "SELL") return t("insider.sentimentSell");
    return t("insider.sentimentNeutral");
  }, [result, t]);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const symbol = symbolInput.trim().toUpperCase();
    if (!symbol) {
      setError(t("insider.validationSymbol"));
      setResult(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const next = await getInsiderMirror(symbol);
      setResult(next);
    } catch (e) {
      setResult(null);
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">{t("insider.title")}</h1>
        <p className="mt-1 text-sm text-slate-400">{t("insider.subtitle")}</p>
      </header>

      <section className="neo-panel rounded-2xl p-6">
        <form onSubmit={onSubmit} className="flex flex-col gap-3 md:flex-row">
          <input
            value={symbolInput}
            onChange={(event) => setSymbolInput(event.target.value.toUpperCase())}
            placeholder={t("insider.symbolPlaceholder")}
            className="w-full rounded-lg border border-brand-border bg-brand-bg px-4 py-2 text-white outline-none focus:border-brand-blue"
            maxLength={16}
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-brand-blue px-5 py-2 font-semibold text-white hover:bg-brand-blue/85 disabled:opacity-60"
          >
            {loading ? t("common.loading") : t("insider.searchButton")}
          </button>
        </form>
      </section>

      {error ? (
        <div className="mt-6 rounded-lg border border-brand-red/30 bg-brand-red/10 p-3 text-sm text-brand-red">
          {error}
        </div>
      ) : null}

      {!loading && !error && result ? (
        <section className="neo-panel mt-6 rounded-2xl p-6">
          <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="text-xl font-semibold text-white">
              {t("insider.resultFor")} {result.symbol}
            </h2>
            <span
              className={`rounded-full border px-4 py-2 text-sm font-bold uppercase tracking-wide ${sentimentClasses(
                result.netSentiment,
              )}`}
            >
              {sentimentLabel}
            </span>
          </div>

          <article className="mt-6 rounded-xl border border-brand-border bg-brand-bg/70 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">{t("insider.insight")}</p>
            <p className="mt-2 text-lg text-slate-100">{result.insight}</p>
          </article>

          <div className="mt-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              {t("insider.transactionsTitle")}
            </h3>
            {result.transactions.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">{t("insider.emptyTransactions")}</p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-xl border border-brand-border">
                <table className="min-w-full divide-y divide-brand-border text-left text-sm">
                  <thead className="bg-brand-bg/60 text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-4 py-2 font-semibold">{t("insider.colName")}</th>
                      <th className="px-4 py-2 font-semibold">{t("insider.colRole")}</th>
                      <th className="px-4 py-2 font-semibold">{t("insider.colAction")}</th>
                      <th className="px-4 py-2 text-right font-semibold">{t("insider.colValue")}</th>
                      <th className="px-4 py-2 font-semibold">{t("insider.colDate")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-border/70 bg-brand-bg/30">
                    {result.transactions.map((tx, idx) => (
                      <tr key={`${tx.name}-${tx.date}-${idx}`}>
                        <td className="px-4 py-2 text-white">{tx.name}</td>
                        <td className="px-4 py-2 text-slate-300">{tx.role}</td>
                        <td className={`px-4 py-2 font-semibold ${actionClasses(tx.action)}`}>
                          {tx.action === "BUY" ? t("insider.actionBuy") : t("insider.actionSell")}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-slate-100">{formatUsd(tx.value)}</td>
                        <td className="px-4 py-2 text-slate-300">{tx.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
