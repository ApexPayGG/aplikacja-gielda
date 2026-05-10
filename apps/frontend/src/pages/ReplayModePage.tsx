import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  evaluateReplayDecision,
  getReplaySnapshot,
  type ReplayAction,
  type ReplayEvaluateResponse,
  type ReplaySnapshotResponse,
} from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";

const SYMBOL_OPTIONS = ["PKN", "KGH", "PKO", "PZU", "PEO", "LPP", "CDR"];
const USER_ID = "demo-user";

function formatPrice(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

export function ReplayModePage() {
  const { t } = useTranslation();
  const [symbol, setSymbol] = useState("PKN");
  const [date, setDate] = useState("");
  const [snapshot, setSnapshot] = useState<ReplaySnapshotResponse | null>(null);
  const [action, setAction] = useState<ReplayAction>("BUY");
  const [price, setPrice] = useState("");
  const [evaluation, setEvaluation] = useState<ReplayEvaluateResponse | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [loadingEvaluation, setLoadingEvaluation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEvaluate = useMemo(
    () => Boolean(snapshot) && Number.isFinite(Number(price)) && Number(price) > 0,
    [snapshot, price],
  );

  async function onLoadSnapshot(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setEvaluation(null);
    setLoadingSnapshot(true);
    try {
      const next = await getReplaySnapshot(symbol, date);
      setSnapshot(next);
      setPrice(formatPrice(next.close));
    } catch (e) {
      setSnapshot(null);
      setError(apiErrorMessage(e));
    } finally {
      setLoadingSnapshot(false);
    }
  }

  async function onEvaluate(event: React.FormEvent) {
    event.preventDefault();
    if (!snapshot) return;
    setError(null);
    setLoadingEvaluation(true);
    try {
      const result = await evaluateReplayDecision({
        userId: USER_ID,
        symbol: snapshot.symbol,
        date: snapshot.date,
        action,
        price: Number(price),
      });
      setEvaluation(result);
    } catch (e) {
      setEvaluation(null);
      setError(apiErrorMessage(e));
    } finally {
      setLoadingEvaluation(false);
    }
  }

  return (
    <div className="min-h-screen bg-brand-bg text-slate-100">
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        <header>
          <h1 className="text-2xl font-bold text-white">{t("replay.title")}</h1>
          <p className="mt-1 text-sm text-slate-400">{t("replay.subtitle")}</p>
        </header>

        {error ? (
          <div className="rounded border border-brand-red/30 bg-brand-red/10 p-3 text-sm text-brand-red">
            {error}
          </div>
        ) : null}

        <section className="neo-panel rounded-xl p-4">
          <h2 className="mb-3 text-lg font-semibold text-white">{t("replay.step1Title")}</h2>
          <form onSubmit={onLoadSnapshot} className="grid gap-3 md:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-400">{t("replay.symbol")}</span>
              <select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="rounded border border-brand-border bg-brand-bg px-3 py-2 text-white"
              >
                {SYMBOL_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-400">{t("replay.date")}</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded border border-brand-border bg-brand-bg px-3 py-2 text-white"
                required
              />
            </label>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={loadingSnapshot}
                className="rounded bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue/85 disabled:opacity-60"
              >
                {loadingSnapshot ? t("common.loading") : t("replay.loadSnapshot")}
              </button>
            </div>
          </form>
        </section>

        {snapshot ? (
          <section className="neo-panel rounded-xl p-4">
            <h2 className="mb-3 text-lg font-semibold text-white">{t("replay.step2Title")}</h2>
            <div className="grid gap-3 text-sm md:grid-cols-3">
              <Stat label="Open" value={formatPrice(snapshot.open)} />
              <Stat label="High" value={formatPrice(snapshot.high)} />
              <Stat label="Low" value={formatPrice(snapshot.low)} />
              <Stat label="Close" value={formatPrice(snapshot.close)} />
              <Stat label="Volume" value={snapshot.volume.toLocaleString()} />
              <Stat
                label={t("replay.priceChange5d")}
                value={`${snapshot.priceChange5d >= 0 ? "+" : ""}${snapshot.priceChange5d.toFixed(2)}%`}
              />
            </div>
            <p className="mt-3 text-sm text-slate-400">{t("replay.contextHint")}</p>
          </section>
        ) : null}

        {snapshot ? (
          <section className="neo-panel rounded-xl p-4">
            <h2 className="mb-3 text-lg font-semibold text-white">{t("replay.step3Title")}</h2>
            <form onSubmit={onEvaluate} className="grid gap-3 md:grid-cols-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-slate-400">{t("replay.action")}</span>
                <select
                  value={action}
                  onChange={(e) => setAction(e.target.value as ReplayAction)}
                  className="rounded border border-brand-border bg-brand-bg px-3 py-2 text-white"
                >
                  <option value="BUY">{t("common.buy")}</option>
                  <option value="SELL">{t("common.sell")}</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-slate-400">{t("replay.price")}</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="rounded border border-brand-border bg-brand-bg px-3 py-2 text-white"
                />
              </label>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={!canEvaluate || loadingEvaluation}
                  className="rounded bg-brand-amber px-4 py-2 text-sm font-semibold text-brand-bg hover:bg-brand-amber/85 disabled:opacity-60"
                >
                  {loadingEvaluation ? t("common.loading") : t("replay.evaluate")}
                </button>
              </div>
            </form>
          </section>
        ) : null}

        {evaluation ? (
          <section className="neo-panel rounded-xl p-4">
            <h2 className="mb-3 text-lg font-semibold text-white">{t("replay.step4Title")}</h2>
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-slate-400">{t("replay.score")}:</span>{" "}
                <span className="font-semibold text-white">{evaluation.score}/10</span>
              </p>
              <p>
                <span className="text-slate-400">{t("replay.actualOutcome")}:</span>{" "}
                <span className="font-semibold text-white">
                  {evaluation.actualOutcome >= 0 ? "+" : ""}
                  {evaluation.actualOutcome.toFixed(2)}%
                </span>
              </p>
              <p className="text-slate-300">{evaluation.explanation}</p>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function Stat(props: { label: string; value: string }) {
  return (
    <div className="rounded border border-brand-border bg-brand-bg/70 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">{props.label}</p>
      <p className="mt-1 text-base font-semibold text-white">{props.value}</p>
    </div>
  );
}
