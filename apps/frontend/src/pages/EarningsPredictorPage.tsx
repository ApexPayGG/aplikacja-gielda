import { FormEvent, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getEarningsPrediction,
  type EarningsPredictionLabel,
  type EarningsPredictionResponse,
} from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";

function badgeClasses(prediction: EarningsPredictionLabel): string {
  if (prediction === "BEAT") return "bg-brand-green/20 text-brand-green border-brand-green/40";
  if (prediction === "MISS") return "bg-brand-red/20 text-brand-red border-brand-red/40";
  return "bg-slate-500/20 text-slate-200 border-slate-500/40";
}

function gaugeClasses(confidence: number): string {
  if (confidence >= 70) return "bg-brand-green";
  if (confidence >= 40) return "bg-brand-amber";
  return "bg-brand-red";
}

export function EarningsPredictorPage() {
  const { t } = useTranslation();
  const [symbolInput, setSymbolInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EarningsPredictionResponse | null>(null);

  const confidenceWidth = useMemo(
    () => `${Math.min(100, Math.max(0, result?.confidence ?? 0))}%`,
    [result?.confidence],
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const symbol = symbolInput.trim().toUpperCase();
    if (!symbol) {
      setError(t("earnings.validationSymbol"));
      setResult(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const next = await getEarningsPrediction(symbol);
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
        <h1 className="text-3xl font-bold text-white">{t("earnings.title")}</h1>
        <p className="mt-1 text-sm text-slate-400">{t("earnings.subtitle")}</p>
      </header>

      <section className="neo-panel rounded-2xl p-6">
        <form onSubmit={onSubmit} className="flex flex-col gap-3 md:flex-row">
          <input
            value={symbolInput}
            onChange={(event) => setSymbolInput(event.target.value)}
            placeholder={t("earnings.symbolPlaceholder")}
            className="w-full rounded-lg border border-brand-border bg-brand-bg px-4 py-2 text-white outline-none focus:border-brand-blue"
            maxLength={16}
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-brand-blue px-5 py-2 font-semibold text-white hover:bg-brand-blue/85 disabled:opacity-60"
          >
            {loading ? t("common.loading") : t("earnings.predictButton")}
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
              {t("earnings.resultFor")} {result.symbol}
            </h2>
            <span
              className={`rounded-full border px-4 py-2 text-lg font-bold tracking-wide ${badgeClasses(result.prediction)}`}
            >
              {result.prediction}
            </span>
          </div>

          <div className="mt-6">
            <p className="mb-2 text-sm text-slate-300">
              {t("earnings.confidence")}: <span className="font-semibold text-white">{result.confidence}%</span>
            </p>
            <div className="h-4 overflow-hidden rounded-full bg-brand-border/60">
              <div
                className={`h-full transition-all duration-500 ${gaugeClasses(result.confidence)}`}
                style={{ width: confidenceWidth }}
              />
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <article className="rounded-xl border border-brand-border bg-brand-bg/70 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">{t("earnings.reasoning")}</p>
              <p className="mt-2 text-slate-100">{result.reasoning}</p>
            </article>
            <article className="rounded-xl border border-brand-border bg-brand-bg/70 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">{t("earnings.nextDate")}</p>
              <p className="mt-2 text-slate-100">{result.nextEarningsDate ?? t("earnings.noDate")}</p>
            </article>
          </div>
        </section>
      ) : null}
    </div>
  );
}
