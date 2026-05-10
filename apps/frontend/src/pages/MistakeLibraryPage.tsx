import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  analyzeBehavioralMistakes,
  getBehavioralMistakes,
  type MistakeLibraryItem,
  type MistakeType,
} from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";

const USER_ID = "demo-user";

function formatSignedPct(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function MistakeLibraryPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<MistakeLibraryItem[]>([]);
  const [summary, setSummary] = useState({ total: 0, emotional: 0, strategy: 0, timing: 0 });
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<void> {
    const data = await getBehavioralMistakes(USER_ID);
    setItems(data.mistakes);
    setSummary(data.summary);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getBehavioralMistakes(USER_ID);
        if (cancelled) return;
        setItems(data.mistakes);
        setSummary(data.summary);
      } catch (e) {
        if (!cancelled) setError(apiErrorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    const byType: Record<MistakeType, MistakeLibraryItem[]> = {
      EMOTIONAL: [],
      STRATEGY: [],
      TIMING: [],
    };
    for (const item of items) {
      if (item.type === "EMOTIONAL" || item.type === "STRATEGY" || item.type === "TIMING") {
        byType[item.type].push(item);
      }
    }
    return byType;
  }, [items]);

  async function onAnalyzeClick(): Promise<void> {
    setAnalyzing(true);
    setError(null);
    try {
      await analyzeBehavioralMistakes(USER_ID);
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-bold text-white">{t("mistakes.title")}</h1>
        <button
          type="button"
          onClick={() => void onAnalyzeClick()}
          disabled={analyzing}
          className="rounded-lg border border-brand-blue/50 bg-brand-blue/20 px-4 py-2 text-sm font-semibold text-brand-blue transition hover:bg-brand-blue/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {analyzing ? t("mistakes.analyzing") : t("mistakes.analyzeButton")}
        </button>
      </header>

      {error ? <p className="mb-4 text-sm text-brand-red">{error}</p> : null}

      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="neo-panel rounded-xl p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">{t("mistakes.summary.total")}</div>
          <div className="mt-2 text-2xl font-bold text-white">{summary.total}</div>
        </div>
        <div className="neo-panel rounded-xl p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">{t("mistakes.summary.emotional")}</div>
          <div className="mt-2 text-2xl font-bold text-red-300">{summary.emotional}</div>
        </div>
        <div className="neo-panel rounded-xl p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">{t("mistakes.summary.strategy")}</div>
          <div className="mt-2 text-2xl font-bold text-amber-300">{summary.strategy}</div>
        </div>
        <div className="neo-panel rounded-xl p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">{t("mistakes.summary.timing")}</div>
          <div className="mt-2 text-2xl font-bold text-brand-blue">{summary.timing}</div>
        </div>
      </section>

      {loading ? (
        <div className="neo-panel rounded-xl p-5 text-slate-400">{t("common.loading")}</div>
      ) : (
        <div className="space-y-5">
          {(["EMOTIONAL", "STRATEGY", "TIMING"] as MistakeType[]).map((type) => (
            <section key={type} className="neo-panel rounded-xl p-5">
              <h2 className="mb-3 text-lg font-semibold text-white">{t(`mistakes.types.${type}`)}</h2>
              {grouped[type].length === 0 ? (
                <p className="text-sm text-slate-500">{t("mistakes.emptyType")}</p>
              ) : (
                <ul className="space-y-2">
                  {grouped[type].map((item) => (
                    <li key={item.id} className="rounded-lg border border-brand-border/60 bg-brand-bg/70 p-3">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-semibold text-white">{item.symbol}</span>
                        <span className="font-mono text-brand-red">{formatSignedPct(item.pnl)}</span>
                        <span className="text-slate-500">{new Date(item.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-300">{item.explanation}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
