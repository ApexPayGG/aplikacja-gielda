import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { explainGlossaryTerm, type GlossaryExplainResponse } from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";

const POPULAR_TERMS = [
  "RSI",
  "MACD",
  "P/E",
  "EPS",
  "EBITDA",
  "dark pool",
  "gamma squeeze",
  "support",
  "resistance",
  "momentum",
  "breakout",
  "oversold",
  "overbought",
  "volume spike",
  "earnings",
  "dividend yield",
  "market cap",
  "short squeeze",
  "bear market",
  "bull market",
] as const;

export function GlossaryPage() {
  const { i18n, t } = useTranslation();
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [payload, setPayload] = useState<GlossaryExplainResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const heading = useMemo(() => selectedTerm ?? t("glossary.selectPrompt"), [selectedTerm, t]);

  async function handleTermClick(term: string): Promise<void> {
    setSelectedTerm(term);
    setLoading(true);
    setError(null);
    try {
      const lang = (i18n.resolvedLanguage || i18n.language || "en").trim();
      const response = await explainGlossaryTerm(term, lang);
      setPayload(response);
    } catch (e) {
      setPayload(null);
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 text-slate-100">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-white">{t("glossary.title")}</h1>
        <p className="mt-2 text-sm text-slate-400">{t("glossary.subtitle")}</p>
      </header>

      <div className="grid gap-6 md:grid-cols-[1.3fr_1fr]">
        <section className="neo-panel rounded-xl p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-blue">
            {t("glossary.popularTerms")}
          </h2>
          <div className="flex flex-wrap gap-2">
            {POPULAR_TERMS.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => void handleTermClick(term)}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  selectedTerm === term
                    ? "border-brand-green/60 bg-brand-green/12 text-brand-green"
                    : "border-slate-700 bg-slate-900/60 text-slate-200 hover:border-brand-blue/60 hover:text-brand-blue"
                }`}
              >
                {term}
              </button>
            ))}
          </div>
        </section>

        <aside className="neo-panel rounded-xl border border-brand-green/35 p-4">
          <h3 className="text-lg font-semibold text-white">{heading}</h3>
          {loading && (
            <div className="mt-3 inline-flex items-center gap-2 text-sm text-slate-300">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-green/35 border-t-brand-green" />
              {t("glossary.loading")}
            </div>
          )}
          {!loading && error && <p className="mt-3 text-sm text-brand-red">{error}</p>}
          {!loading && !error && payload && (
            <div className="mt-3 space-y-2 text-sm text-slate-200">
              <p>{payload.explanation}</p>
              <p className="text-slate-300">
                {t("glossary.exampleLabel")}: {payload.example}
              </p>
            </div>
          )}
          {!loading && !error && !payload && (
            <p className="mt-3 text-sm text-slate-400">{t("glossary.selectPrompt")}</p>
          )}
        </aside>
      </div>
    </div>
  );
}
