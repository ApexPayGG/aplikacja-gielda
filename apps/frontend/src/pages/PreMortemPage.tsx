import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { runPreMortem, type PreMortemResponse } from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";

const USER_ID = window.localStorage.getItem("userId")?.trim() || "";
const PLN_PER_USD = 3.95;

export function PreMortemPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({
    symbol: "",
    entry: "",
    stopLoss: "",
    takeProfit: "",
    quantity: "1",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PreMortemResponse | null>(null);
  const [prefillNote, setPrefillNote] = useState<string | null>(null);

  useEffect(() => {
    const symbol = searchParams.get("symbol");
    const entry = searchParams.get("entry");
    const stopLoss = searchParams.get("stopLoss");
    const takeProfit = searchParams.get("takeProfit");
    const quantity = searchParams.get("quantity");
    const regime = searchParams.get("regime");
    if (symbol || entry || stopLoss || takeProfit || quantity) {
      setForm((prev) => ({
        symbol: symbol?.trim().toUpperCase() || prev.symbol,
        entry: entry != null && entry !== "" ? entry : prev.entry,
        stopLoss: stopLoss != null && stopLoss !== "" ? stopLoss : prev.stopLoss,
        takeProfit: takeProfit != null && takeProfit !== "" ? takeProfit : prev.takeProfit,
        quantity: quantity != null && quantity !== "" ? quantity : prev.quantity,
      }));
    }
    setPrefillNote(regime ? t("pearls.premortemPrefilledRegime", { regime }) : null);
  }, [searchParams, t]);

  async function onSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await runPreMortem({
        symbol: form.symbol.trim().toUpperCase(),
        entry: Number(form.entry),
        stopLoss: Number(form.stopLoss),
        takeProfit: Number(form.takeProfit),
        quantity: Number(form.quantity),
        userId: USER_ID,
      });
      setResult(response);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-2 text-3xl font-bold text-white">{t("premortem.title")}</h1>
      <p className="mb-6 text-sm text-slate-400">{t("premortem.subtitle")}</p>

      {prefillNote ? (
        <div className="mb-4 rounded-lg border border-brand-blue/40 bg-brand-blue/10 px-4 py-3 text-sm text-slate-200">
          {prefillNote}
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="neo-panel rounded-xl p-5">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">{t("premortem.symbol")}</span>
            <input
              className="rounded border border-brand-border bg-brand-bg px-3 py-2 text-white outline-none focus:border-brand-blue"
              value={form.symbol}
              onChange={(e) => setForm((prev) => ({ ...prev, symbol: e.target.value.toUpperCase() }))}
              placeholder="AAPL"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">{t("premortem.quantity")}</span>
            <input
              type="number"
              className="rounded border border-brand-border bg-brand-bg px-3 py-2 text-white outline-none focus:border-brand-blue"
              value={form.quantity}
              onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">{t("premortem.entry")}</span>
            <input
              type="number"
              step="0.01"
              className="rounded border border-brand-border bg-brand-bg px-3 py-2 text-white outline-none focus:border-brand-blue"
              value={form.entry}
              onChange={(e) => setForm((prev) => ({ ...prev, entry: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">{t("premortem.stopLoss")}</span>
            <input
              type="number"
              step="0.01"
              className="rounded border border-brand-border bg-brand-bg px-3 py-2 text-white outline-none focus:border-brand-blue"
              value={form.stopLoss}
              onChange={(e) => setForm((prev) => ({ ...prev, stopLoss: e.target.value }))}
            />
          </label>
          <label className="md:col-span-2 flex flex-col gap-1 text-sm">
            <span className="text-slate-400">{t("premortem.takeProfit")}</span>
            <input
              type="number"
              step="0.01"
              className="rounded border border-brand-border bg-brand-bg px-3 py-2 text-white outline-none focus:border-brand-blue"
              value={form.takeProfit}
              onChange={(e) => setForm((prev) => ({ ...prev, takeProfit: e.target.value }))}
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-4 rounded bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue/85 disabled:opacity-60"
        >
          {loading ? t("common.loading") : t("premortem.runButton")}
        </button>
      </form>

      {error ? <p className="mt-4 text-sm text-brand-red">{error}</p> : null}

      {result ? (
        <section className="mt-5 rounded-xl border border-brand-red/40 bg-brand-red/10 p-5">
          <h2 className="font-semibold text-red-100">🎯 PRE-MORTEM ANALYSIS</h2>
          <p className="mt-2 text-sm text-red-100">{result.scenario}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <span className="rounded bg-brand-amber/20 px-2 py-1 font-semibold text-brand-amber">{result.probability}% chance</span>
            <span className="rounded bg-slate-700/50 px-2 py-1 text-slate-200">
              {Math.abs(result.maxLoss).toFixed(2)} PLN (~{(Math.abs(result.maxLoss) / PLN_PER_USD).toFixed(2)} USD)
            </span>
            <span className="rounded bg-slate-700/50 px-2 py-1 text-slate-300">
              {t("premortem.marketRegime")}: {result.marketRegime}
            </span>
          </div>
        </section>
      ) : null}
    </div>
  );
}
