import type { TFunction } from "i18next";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { ShareButton } from "../components/ShareButton";
import { getStrategyDna, type StrategyDnaResponse } from "../services/api";
import {
  TERMINAL_INSIGHT_CARD,
  TERMINAL_INTELLIGENCE_CARD,
  TERMINAL_INTELLIGENCE_GRID,
  TERMINAL_INTELLIGENCE_PAGE,
  TERMINAL_INTELLIGENCE_PAGE_INNER,
  TERMINAL_INTELLIGENCE_PANEL,
  TERMINAL_PAGE_SUBTITLE,
  TERMINAL_PAGE_TITLE,
  TERMINAL_SCORE_TILE,
  TERMINAL_WARNING_PANEL,
} from "../components/terminal/terminalStyles";
import { apiErrorMessage } from "../utils/apiErrorMessage";

const USER_ID = window.localStorage.getItem("userId")?.trim() || "";

function legendLabel(name: StrategyDnaResponse["primary"]["name"]): string {
  if (name === "BUFFETT") return "Buffett";
  if (name === "LYNCH") return "Lynch";
  if (name === "GREENBLATT") return "Graham";
  return "Soros";
}

function pct(value: number): string {
  return `${Math.round(value)}%`;
}

type SetupItem = {
  name: string;
  frequency: number;
};

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function investorMatchPct(
  data: StrategyDnaResponse,
  target: StrategyDnaResponse["primary"]["name"],
  fallback: number,
): number {
  if (data.primary.name === target) return clampPercent(data.primary.pct);
  if (data.secondary.name === target) return clampPercent(data.secondary.pct);
  return clampPercent(fallback);
}

function buildSetups(data: StrategyDnaResponse, t: TFunction): SetupItem[] {
  const sectors = data.stats.preferredSectors ?? [];
  if (sectors.length > 0) {
    return sectors.slice(0, 4).map((sector, index) => ({
      name: t("strategyDnaPage.setupsSectorPrefix", {
        sector,
        defaultValue: "Sector setup: {{sector}}",
      }),
      frequency: clampPercent(74 - index * 14),
    }));
  }

  return [
    { name: t("strategyDnaPage.fallbackSetup1", { defaultValue: "Mean reversion after a sharp drop" }), frequency: 62 },
    {
      name: t("strategyDnaPage.fallbackSetup2", { defaultValue: "Trend continuation after a breakout" }),
      frequency: 51,
    },
    {
      name: t("strategyDnaPage.fallbackSetup3", { defaultValue: "Defensive setup in high volatility" }),
      frequency: 37,
    },
  ];
}

export function StrategyDnaPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<StrategyDnaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fromMistakes = searchParams.get("from") === "mistakes";
  const highlightSymbols = useMemo(() => {
    const one = searchParams.get("symbol")?.trim().toUpperCase();
    if (one) return [one];
    const raw = searchParams.get("symbols") ?? "";
    return raw
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await getStrategyDna(USER_ID);
        if (!cancelled) setData(result);
      } catch (e) {
        if (!cancelled) {
          setData(null);
          setError(apiErrorMessage(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const dominantStyle = data ? legendLabel(data.primary.name) : "";
  const investorMatch = data ? clampPercent(data.primary.pct) : 0;
  const shareInvestor = dominantStyle;
  const strategyShareUrl =
    USER_ID.length > 0 ? `https://stock-ai.pro/strategy-dna/${encodeURIComponent(USER_ID)}` : "https://stock-ai.pro/strategy-dna";
  const strategyShareText = data
    ? t("strategyDnaPage.shareTweet", {
        style: dominantStyle,
        match: investorMatch,
        investor: shareInvestor,
        defaultValue: "🧬 My investing style: {{style}} | {{match}}% match vs {{investor}} | StockAI Pro",
      })
    : undefined;

  return (
    <div className={TERMINAL_INTELLIGENCE_PAGE}>
      <div className={`${TERMINAL_INTELLIGENCE_PAGE_INNER} max-w-6xl`}>
      <header className={TERMINAL_INTELLIGENCE_PANEL}>
        <h1 className={TERMINAL_PAGE_TITLE}>{t("strategyDnaPage.title", { defaultValue: "Strategy DNA" })}</h1>
        <p className={`mt-2 ${TERMINAL_PAGE_SUBTITLE}`}>
          {t("strategyDnaPage.subtitle", {
            defaultValue: "Discover your decision patterns and dominant investing profile.",
          })}
        </p>
        {data && data.hasEnoughData ? (
          <div className="mt-4">
            <ShareButton
              label={t("strategyDnaPage.shareLabel", { defaultValue: "Share your style" })}
              url={strategyShareUrl}
              twitterText={strategyShareText}
            />
          </div>
        ) : null}
      </header>

      {fromMistakes && highlightSymbols.length > 0 ? (
        <div className={TERMINAL_WARNING_PANEL}>
          <p className="font-semibold text-terminal-text">
            {t("strategyDnaPage.fromMistakesTitle", { defaultValue: "Context from mistake library" })}
          </p>
          <p className="mt-1 text-terminal-textMuted">
            {t("strategyDnaPage.fromMistakesSymbols", {
              symbols: highlightSymbols.join(", "),
              defaultValue: "Symbols from mistakes: {{symbols}}.",
            })}
          </p>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-terminal-textMuted">{t("common.loading", { defaultValue: "Loading..." })}</p>
      ) : null}
      {error && (
        <p className="rounded-xl border border-negative/30 bg-negative/10 px-4 py-3 text-sm font-medium text-negative">{error}</p>
      )}

      {!loading && !error && data ? (
        <>
          {data.hasEnoughData ? (
            <section className={TERMINAL_INTELLIGENCE_PANEL}>
              <h2 className="text-lg font-semibold text-terminal-cyan">
                {t("strategyDnaPage.yourStyleHeading", { defaultValue: "Your investing style" })}
              </h2>
              <div className="mt-5 grid gap-6 md:grid-cols-[260px_1fr]">
                <div className={`flex flex-col items-center justify-center ${TERMINAL_INTELLIGENCE_CARD}`}>
                  <div className="flex h-44 w-44 flex-col items-center justify-center rounded-full border border-terminal-cyan/40 bg-terminal-cyan/15 text-center text-terminal-text shadow-terminal-glow">
                    <p className="text-xs uppercase tracking-wide text-terminal-textMuted">Dominant style</p>
                    <p className="mt-1 text-xl font-bold">{legendLabel(data.primary.name)}</p>
                    <p className="text-sm font-semibold">{pct(data.primary.pct)}</p>
                  </div>
                </div>

                <div className="space-y-5">
                  <MatchBar label="Lynch" value={investorMatchPct(data, "LYNCH", data.stats.winRate * 0.85)} />
                  <MatchBar label="Buffett" value={investorMatchPct(data, "BUFFETT", 100 - data.stats.riskTolerance)} />
                  <MatchBar label="Graham" value={investorMatchPct(data, "GREENBLATT", data.stats.winRate * 0.75)} />
                </div>
              </div>
            </section>
          ) : (
            <section className={`${TERMINAL_WARNING_PANEL} text-center`}>
              <p className="text-lg font-semibold text-terminal-text">
                {t("strategyDnaPage.notEnoughTrades", { defaultValue: "You need at least 20 closed trades." })}
              </p>
            </section>
          )}

          <section className="grid gap-6 md:grid-cols-2">
            <div className={TERMINAL_INTELLIGENCE_PANEL}>
              <h3 className="text-lg font-semibold text-terminal-cyan">
                {t("strategyDnaPage.setupsHeading", { defaultValue: "Your setups" })}
              </h3>
              <ul className="mt-4 space-y-3">
                {buildSetups(data, t).map((setup) => (
                  <li
                    key={setup.name}
                    className={`flex items-center justify-between gap-3 ${TERMINAL_INTELLIGENCE_CARD}`}
                  >
                    <span className="text-sm font-medium text-terminal-text">{setup.name}</span>
                    <span className="rounded-full border border-terminal-cyan/30 bg-terminal-cyan/10 px-2.5 py-1 text-xs font-semibold text-terminal-cyan">
                      {setup.frequency}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className={TERMINAL_INTELLIGENCE_PANEL}>
              <h3 className="text-lg font-semibold text-terminal-cyan">AI insight</h3>
              <p className="mt-3 text-sm leading-6 text-terminal-textSecondary">{data.insight}</p>

              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <StatTile label="Win rate" value={pct(data.stats.winRate)} />
                <StatTile
                  label="Avg holding"
                  value={t("strategyDnaPage.avgHoldDays", {
                    days: Math.round(data.stats.avgHoldingDays),
                    defaultValue: "{{days}} days",
                  })}
                />
                <StatTile
                  label={t("strategyDnaPage.avgWin", { defaultValue: "Avg win" })}
                  value={`${data.stats.avgWinPct.toFixed(1)}%`}
                />
                <StatTile
                  label={t("strategyDnaPage.avgLoss", { defaultValue: "Avg loss" })}
                  value={`${data.stats.avgLossPct.toFixed(1)}%`}
                />
              </div>
            </div>
          </section>

          <section className={TERMINAL_INTELLIGENCE_PANEL}>
            <h3 className="text-lg font-semibold text-terminal-cyan">
              {t("strategyDnaPage.recommendationsHeading", { defaultValue: "Recommendations" })}
            </h3>
            <div className={`mt-4 ${TERMINAL_INTELLIGENCE_GRID} md:grid-cols-3`}>
              <RecommendationCard
                title={t("strategyDnaPage.recPlayStyle.title", {
                  defaultValue: "Trade your dominant style",
                })}
                body={t("strategyDnaPage.recPlayStyle.body", {
                  style: legendLabel(data.primary.name),
                  pct: pct(data.primary.pct),
                  defaultValue:
                    "Highest match is {{style}} ({{pct}}). Build a playbook for that profile.",
                })}
              />
              <RecommendationCard
                title={t("strategyDnaPage.recRotateSetup.title", {
                  defaultValue: "Rotate sector setups",
                })}
                body={t("strategyDnaPage.recRotateSetup.body")}
              />
              <RecommendationCard
                title={t("strategyDnaPage.recFocusRisk.title", {
                  defaultValue: "Watch position risk",
                })}
                body={t("strategyDnaPage.recFocusRisk.body", {
                  pct: pct(data.stats.riskTolerance),
                  defaultValue:
                    "Current risk tolerance is {{pct}}. Keep position sizing aligned with your plan.",
                })}
              />
            </div>
          </section>
        </>
      ) : null}
      </div>
    </div>
  );
}

function MatchBar(props: { label: string; value: number }) {
  const width = clampPercent(props.value);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium text-terminal-text">{props.label}</span>
        <span className="font-semibold text-terminal-cyan">{width}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-terminal-panelSecondary">
        <div className="h-full rounded-full bg-terminal-cyan" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function StatTile(props: { label: string; value: string }) {
  return (
    <div className={TERMINAL_SCORE_TILE}>
      <p className="text-xs text-terminal-textMuted">{props.label}</p>
      <p className="mt-1 font-semibold text-terminal-text">{props.value}</p>
    </div>
  );
}

function RecommendationCard(props: { title: string; body: string }) {
  return (
    <article className={TERMINAL_INSIGHT_CARD}>
      <h4 className="text-sm font-semibold text-terminal-text">{props.title}</h4>
      <p className="mt-2 text-sm leading-6 text-terminal-textSecondary">{props.body}</p>
    </article>
  );
}
