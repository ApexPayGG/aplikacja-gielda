import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  analyzeBehavioralMistakes,
  getBehavioralMistakes,
  type MistakeLibraryItem,
  type MistakeType,
} from "../services/api";
import {
  GLASS_BTN_PRIMARY,
  GLASS_HERO,
  GLASS_PAGE_BG,
  GLASS_PAGE_SUBTITLE,
  GLASS_PAGE_TITLE,
  GLASS_SECTION,
  GLASS_STAT_CARD,
} from "../components/behavioral-coach/glassStyles";
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
    if (!sorted[0] || sorted[0][1] === 0) return t("mistakes.noData", { defaultValue: "No data" });
    return typeMeta[sorted[0][0]].label;
  }, [typeCounters, t]);

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
    <div className={`${GLASS_PAGE_BG} px-4 py-10`}>
      <div className="mx-auto max-w-6xl">
        <header className={`${GLASS_HERO} mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between`}>
          <div>
            <h1 className={GLASS_PAGE_TITLE}>{t("mistakes.title", { defaultValue: "Mistake Library" })}</h1>
            <p className={`${GLASS_PAGE_SUBTITLE} mt-2`}>
              {t("mistakes.subtitle", {
                defaultValue: "Most common investing mistake patterns and their cost.",
              })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {mistakeSymbols.length > 0 ? (
              <Link
                to={`/strategy-dna?from=mistakes&symbols=${encodeURIComponent(mistakeSymbols.join(","))}`}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-[#22d3ee] hover:bg-white/10"
              >
                {t("mistakes.dnaContextLink")}
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => void onAnalyzeClick()}
              disabled={analyzing}
              className={`${GLASS_BTN_PRIMARY} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {analyzing ? t("mistakes.analyzing") : t("mistakes.analyzeButton")}
            </button>
          </div>
        </header>

        {error ? (
          <p className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
        ) : null}

        <section className="mb-6 grid gap-3 md:grid-cols-3">
          <article className={GLASS_STAT_CARD}>
            <p className="text-xs uppercase tracking-wide text-white/50">{t("mistakes.totalErrors", { defaultValue: "Total mistakes" })}</p>
            <p className="mt-2 text-3xl font-bold text-white">{summary.total}</p>
          </article>
          <article className={GLASS_STAT_CARD}>
            <p className="text-xs uppercase tracking-wide text-white/50">{t("mistakes.mostCommonType", { defaultValue: "Most common type" })}</p>
            <p className="mt-2 text-2xl font-bold text-[#22d3ee]">{mostCommonType}</p>
          </article>
          <article className={GLASS_STAT_CARD}>
            <p className="text-xs uppercase tracking-wide text-white/50">{t("mistakes.costPct", { defaultValue: "Mistake cost %" })}</p>
            <p className={`mt-2 text-2xl font-bold ${totalCostPct < 0 ? "text-red-400" : "text-emerald-400"}`}>{formatSignedPct(totalCostPct)}</p>
          </article>
        </section>

        <section className={`${GLASS_SECTION} mb-4`}>
          <p className="mb-3 text-sm font-semibold text-white/70">{t("mistakes.filterByType", { defaultValue: "Filter by type" })}</p>
          <div className="flex flex-wrap gap-2">
            {(["ALL", "EMOTIONAL", "STRATEGY", "TIMING"] as MistakeFilter[]).map((type) => {
              const active = filter === type;
              const label = type === "ALL" ? t("mistakes.filterAll", { defaultValue: "All" }) : typeMeta[type].label;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFilter(type)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "border-[#a855f7]/50 bg-[#a855f7]/15 text-[#22d3ee]"
                      : "border-white/15 bg-white/5 text-white/60 hover:border-white/25"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </section>

        {loading ? (
          <div className={`${GLASS_SECTION} text-sm text-white/60`}>{t("common.loading")}</div>
        ) : filteredItems.length === 0 ? (
          <div className={`${GLASS_SECTION} text-sm text-white/60`}>
            {t("mistakes.emptyFilter", { defaultValue: "No mistakes for the selected filter." })}
          </div>
        ) : (
          <ul className="space-y-3">
            {filteredItems.map((item) => {
              const meta = typeMeta[item.type];
              return (
                <li key={item.id} className={GLASS_SECTION}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
                      style={{ backgroundColor: meta.badgeBg, color: meta.badgeColor }}
                    >
                      {meta.label}
                    </span>
                    <span className="text-xs font-medium text-white/50">
                      {new Date(item.createdAt).toLocaleDateString("en-US")}
                    </span>
                    <span className={`text-xs font-semibold ${item.pnl < 0 ? "text-red-400" : "text-emerald-400"}`}>
                      {t("mistakes.costLabel", { defaultValue: "Cost:" })} {formatSignedPct(item.pnl)}
                    </span>
                    <Link
                      to={`/strategy-dna?from=mistakes&symbol=${encodeURIComponent(item.symbol)}`}
                      className="ml-auto text-xs font-semibold text-[#22d3ee] hover:underline"
                    >
                      {t("mistakes.dnaRowLink")}
                    </Link>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-white">{item.symbol}</p>
                  <p className="mt-1 text-sm text-white/65">{item.explanation}</p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
