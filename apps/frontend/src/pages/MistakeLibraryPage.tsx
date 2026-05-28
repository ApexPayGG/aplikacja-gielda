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
  TERMINAL_BUTTON_PRIMARY,
  TERMINAL_DANGER_PANEL,
  TERMINAL_FILTER_CHIP,
  TERMINAL_FILTER_CHIP_ACTIVE,
  TERMINAL_LINK_ACCENT,
  TERMINAL_PAGE_SUBTITLE,
  TERMINAL_PAGE_TITLE,
  TERMINAL_TOOL_HERO,
  TERMINAL_TOOL_PAGE,
  TERMINAL_TOOL_PAGE_INNER,
  TERMINAL_TOOL_PANEL,
  TERMINAL_TOOL_RESULT_CARD,
} from "../components/terminal/terminalStyles";
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
    badgeColor: "#ef4444",
    badgeBg: "rgba(239, 68, 68, 0.12)",
  },
  STRATEGY: {
    label: "Strategy",
    badgeColor: "#f59e0b",
    badgeBg: "rgba(245, 158, 11, 0.16)",
  },
  TIMING: {
    label: "Timing",
    badgeColor: "#22d3ee",
    badgeBg: "rgba(34, 211, 238, 0.12)",
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
    <div className={TERMINAL_TOOL_PAGE}>
      <div className={TERMINAL_TOOL_PAGE_INNER}>
        <header className={`${TERMINAL_TOOL_HERO} mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between`}>
          <div>
            <h1 className={TERMINAL_PAGE_TITLE}>{t("mistakes.title", { defaultValue: "Mistake Library" })}</h1>
            <p className={`${TERMINAL_PAGE_SUBTITLE} mt-2`}>
              {t("mistakes.subtitle", {
                defaultValue: "Most common investing mistake patterns and their cost.",
              })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {mistakeSymbols.length > 0 ? (
              <Link
                to={`/strategy-dna?from=mistakes&symbols=${encodeURIComponent(mistakeSymbols.join(","))}`}
                className={`${TERMINAL_LINK_ACCENT} rounded-lg border border-terminal-borderMuted bg-terminal-panelSecondary px-3 py-2 text-sm no-underline`}
              >
                {t("mistakes.dnaContextLink")}
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => void onAnalyzeClick()}
              disabled={analyzing}
              className={`${TERMINAL_BUTTON_PRIMARY} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {analyzing ? t("mistakes.analyzing") : t("mistakes.analyzeButton")}
            </button>
          </div>
        </header>

        {error ? <div className={`mb-4 ${TERMINAL_DANGER_PANEL}`}>{error}</div> : null}

        <section className="mb-6 grid gap-3 md:grid-cols-3">
          <article className={TERMINAL_TOOL_RESULT_CARD}>
            <p className="text-xs uppercase tracking-wide text-terminal-textMuted">{t("mistakes.totalErrors", { defaultValue: "Total mistakes" })}</p>
            <p className="mt-2 text-3xl font-bold text-terminal-text">{summary.total}</p>
          </article>
          <article className={TERMINAL_TOOL_RESULT_CARD}>
            <p className="text-xs uppercase tracking-wide text-terminal-textMuted">{t("mistakes.mostCommonType", { defaultValue: "Most common type" })}</p>
            <p className="mt-2 text-2xl font-bold text-terminal-cyan">{mostCommonType}</p>
          </article>
          <article className={TERMINAL_TOOL_RESULT_CARD}>
            <p className="text-xs uppercase tracking-wide text-terminal-textMuted">{t("mistakes.costPct", { defaultValue: "Mistake cost %" })}</p>
            <p className={`mt-2 text-2xl font-bold ${totalCostPct < 0 ? "text-terminal-negative" : "text-terminal-positive"}`}>{formatSignedPct(totalCostPct)}</p>
          </article>
        </section>

        <section className={`${TERMINAL_TOOL_PANEL} mb-4`}>
          <p className="mb-3 text-sm font-semibold text-terminal-textSecondary">{t("mistakes.filterByType", { defaultValue: "Filter by type" })}</p>
          <div className="flex flex-wrap gap-2">
            {(["ALL", "EMOTIONAL", "STRATEGY", "TIMING"] as MistakeFilter[]).map((type) => {
              const active = filter === type;
              const label = type === "ALL" ? t("mistakes.filterAll", { defaultValue: "All" }) : typeMeta[type].label;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFilter(type)}
                  className={active ? TERMINAL_FILTER_CHIP_ACTIVE : TERMINAL_FILTER_CHIP}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </section>

        {loading ? (
          <div className={`${TERMINAL_TOOL_PANEL} text-sm text-terminal-textMuted`}>{t("common.loading")}</div>
        ) : filteredItems.length === 0 ? (
          <div className={`${TERMINAL_TOOL_PANEL} text-sm text-terminal-textMuted`}>
            {t("mistakes.emptyFilter", { defaultValue: "No mistakes for the selected filter." })}
          </div>
        ) : (
          <ul className="space-y-3">
            {filteredItems.map((item) => {
              const meta = typeMeta[item.type];
              return (
                <li key={item.id} className={TERMINAL_TOOL_PANEL}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
                      style={{ backgroundColor: meta.badgeBg, color: meta.badgeColor }}
                    >
                      {meta.label}
                    </span>
                    <span className="text-xs font-medium text-terminal-textMuted">
                      {new Date(item.createdAt).toLocaleDateString("en-US")}
                    </span>
                    <span className={`text-xs font-semibold ${item.pnl < 0 ? "text-terminal-negative" : "text-terminal-positive"}`}>
                      {t("mistakes.costLabel", { defaultValue: "Cost:" })} {formatSignedPct(item.pnl)}
                    </span>
                    <Link
                      to={`/strategy-dna?from=mistakes&symbol=${encodeURIComponent(item.symbol)}`}
                      className={`${TERMINAL_LINK_ACCENT} ml-auto text-xs`}
                    >
                      {t("mistakes.dnaRowLink")}
                    </Link>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-terminal-cyan">{item.symbol}</p>
                  <p className="mt-1 text-sm text-terminal-textSecondary">{item.explanation}</p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
