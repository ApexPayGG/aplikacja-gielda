import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  analyzeBehavioralMistakes,
  getBehavioralMistakes,
  type MistakeLibraryItem,
  type MistakeType,
} from "../services/api";
import { colors } from "../styles/designSystem";
import { apiErrorMessage } from "../utils/apiErrorMessage";

const USER_ID = window.localStorage.getItem("userId")?.trim() || "";

function formatSignedPct(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

type MistakeFilter = "ALL" | MistakeType;

const typeMeta: Record<
  MistakeType,
  {
    label: string;
    badgeColor: string;
    badgeBg: string;
  }
> = {
  EMOTIONAL: {
    label: "Emotions",
    badgeColor: colors.negative,
    badgeBg: "rgba(229, 57, 53, 0.12)",
  },
  STRATEGY: {
    label: "Strategy",
    badgeColor: colors.brandGold,
    badgeBg: "rgba(255, 174, 51, 0.16)",
  },
  TIMING: {
    label: "Timing",
    badgeColor: colors.brandMedium,
    badgeBg: "rgba(122, 15, 158, 0.12)",
  },
};

export function MistakeLibraryPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<MistakeLibraryItem[]>([]);
  const [summary, setSummary] = useState({ total: 0, emotional: 0, strategy: 0, timing: 0 });
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<MistakeFilter>("ALL");

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

  const mistakeSymbols = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      set.add(item.symbol);
    }
    return [...set];
  }, [items]);

  const typeCounters = useMemo(
    () => ({
      EMOTIONAL: items.filter((item) => item.type === "EMOTIONAL").length,
      STRATEGY: items.filter((item) => item.type === "STRATEGY").length,
      TIMING: items.filter((item) => item.type === "TIMING").length,
    }),
    [items],
  );

  const mostCommonType = useMemo(() => {
    const sorted = (Object.entries(typeCounters) as Array<[MistakeType, number]>).sort((a, b) => b[1] - a[1]);
    if (!sorted[0] || sorted[0][1] === 0) return "Brak danych";
    return typeMeta[sorted[0][0]].label;
  }, [typeCounters]);

  const totalCostPct = useMemo(() => items.reduce((sum, item) => sum + item.pnl, 0), [items]);

  const filteredItems = useMemo(() => {
    if (filter === "ALL") return items;
    return items.filter((item) => item.type === filter);
  }, [filter, items]);

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
    <div className="min-h-screen px-4 py-10" style={{ backgroundColor: colors.bgSecondary, color: colors.textPrimary }}>
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Biblioteka błędów</h1>
            <p className="mt-2 text-sm md:text-base" style={{ color: colors.textSecondary }}>
              Najczęstsze schematy błędów inwestycyjnych wraz z ich kosztem.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {mistakeSymbols.length > 0 ? (
              <Link
                to={`/strategy-dna?from=mistakes&symbols=${encodeURIComponent(mistakeSymbols.join(","))}`}
                className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold"
                style={{ borderColor: colors.borderStrong, color: colors.brandDark }}
              >
                {t("mistakes.dnaContextLink")}
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => void onAnalyzeClick()}
              disabled={analyzing}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: colors.brandDark }}
            >
              {analyzing ? t("mistakes.analyzing") : t("mistakes.analyzeButton")}
            </button>
          </div>
        </header>

        {error ? (
          <p className="mb-4 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: colors.negative, color: colors.negative }}>
            {error}
          </p>
        ) : null}

        <section className="mb-6 grid gap-3 md:grid-cols-3">
          <article className="rounded-2xl border bg-white p-4 shadow-sm" style={{ borderColor: colors.border }}>
            <p className="text-xs uppercase tracking-wide" style={{ color: colors.textMuted }}>
              Łączne błędy
            </p>
            <p className="mt-2 text-3xl font-bold" style={{ color: colors.brandDark }}>
              {summary.total}
            </p>
          </article>
          <article className="rounded-2xl border bg-white p-4 shadow-sm" style={{ borderColor: colors.border }}>
            <p className="text-xs uppercase tracking-wide" style={{ color: colors.textMuted }}>
              Najczęstszy typ
            </p>
            <p className="mt-2 text-2xl font-bold" style={{ color: colors.brandMedium }}>
              {mostCommonType}
            </p>
          </article>
          <article className="rounded-2xl border bg-white p-4 shadow-sm" style={{ borderColor: colors.border }}>
            <p className="text-xs uppercase tracking-wide" style={{ color: colors.textMuted }}>
              Koszt błędów w %
            </p>
            <p className="mt-2 text-2xl font-bold" style={{ color: totalCostPct < 0 ? colors.negative : colors.positive }}>
              {formatSignedPct(totalCostPct)}
            </p>
          </article>
        </section>

        <section className="mb-4 rounded-2xl border bg-white p-4 shadow-sm" style={{ borderColor: colors.border }}>
          <p className="mb-3 text-sm font-semibold" style={{ color: colors.textSecondary }}>
            Filtr po typie
          </p>
          <div className="flex flex-wrap gap-2">
            {(["ALL", "EMOTIONAL", "STRATEGY", "TIMING"] as MistakeFilter[]).map((type) => {
              const active = filter === type;
              const label = type === "ALL" ? "Wszystkie" : typeMeta[type].label;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFilter(type)}
                  className="rounded-full border px-3 py-1.5 text-xs font-semibold transition"
                  style={{
                    borderColor: active ? colors.brandDark : colors.borderStrong,
                    backgroundColor: active ? "rgba(45, 10, 107, 0.1)" : colors.bgPrimary,
                    color: active ? colors.brandDark : colors.textSecondary,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </section>

        {loading ? (
          <div className="rounded-xl border bg-white p-5 text-sm" style={{ borderColor: colors.border, color: colors.textSecondary }}>
            {t("common.loading")}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-xl border bg-white p-5 text-sm" style={{ borderColor: colors.border, color: colors.textSecondary }}>
            Brak błędów dla wybranego filtra.
          </div>
        ) : (
          <ul className="space-y-3">
            {filteredItems.map((item) => {
              const meta = typeMeta[item.type];
              return (
                <li key={item.id} className="rounded-2xl border bg-white p-4 shadow-sm" style={{ borderColor: colors.border }}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
                      style={{ backgroundColor: meta.badgeBg, color: meta.badgeColor }}
                    >
                      {meta.label}
                    </span>
                    <span className="text-xs font-medium" style={{ color: colors.textMuted }}>
                      {new Date(item.createdAt).toLocaleDateString("pl-PL")}
                    </span>
                    <span className="text-xs font-semibold" style={{ color: item.pnl < 0 ? colors.negative : colors.positive }}>
                      Koszt: {formatSignedPct(item.pnl)}
                    </span>
                    <Link
                      to={`/strategy-dna?from=mistakes&symbol=${encodeURIComponent(item.symbol)}`}
                      className="ml-auto text-xs font-semibold hover:underline"
                      style={{ color: colors.brandDark }}
                    >
                      {t("mistakes.dnaRowLink")}
                    </Link>
                  </div>
                  <p className="mt-2 text-sm font-semibold" style={{ color: colors.brandDark }}>
                    {item.symbol}
                  </p>
                  <p className="mt-1 text-sm" style={{ color: colors.textSecondary }}>
                    {item.explanation}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
