import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getCrowdWisdom, searchCompanies, type Company, type CrowdWisdomResponse } from "../services/api";
import {
  TERMINAL_BUTTON_PRIMARY,
  TERMINAL_DANGER_PANEL,
  TERMINAL_DATA_TABLE,
  TERMINAL_INFO_BANNER,
  TERMINAL_INPUT,
  TERMINAL_INTELLIGENCE_CARD,
  TERMINAL_INTELLIGENCE_GRID,
  TERMINAL_INTELLIGENCE_PAGE,
  TERMINAL_INTELLIGENCE_PAGE_INNER,
  TERMINAL_INTELLIGENCE_PANEL,
  TERMINAL_PAGE_SUBTITLE,
  TERMINAL_PAGE_TITLE,
  TERMINAL_PREDICTOR_PANEL,
  TERMINAL_SCORE_TILE,
  TERMINAL_SEARCH_DROPDOWN,
  TERMINAL_TABLE_HEAD,
  TERMINAL_TABLE_ROW,
} from "../components/terminal/terminalStyles";
import { apiErrorMessage } from "../utils/apiErrorMessage";

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

function sentimentSummary(value: number): { percent: number; label: "buying" | "selling"; tone: "positive" | "negative" } {
  const clamped = clampPercent(value);
  if (clamped >= 50) {
    return { percent: clamped, label: "buying", tone: "positive" };
  }
  return { percent: 100 - clamped, label: "selling", tone: "negative" };
}

function formatPercent(value: number): string {
  return `${clampPercent(value).toFixed(1)}%`;
}

function formatDivergence(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)} pp`;
}

const DIVERGENCE_GOLD_THRESHOLD = 15;

export function CrowdWisdomPage() {
  const { t } = useTranslation();
  const [symbolInput, setSymbolInput] = useState("AAPL");
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<Company[]>([]);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<CrowdWisdomResponse | null>(null);
  const [scannedCompanies, setScannedCompanies] = useState<CrowdWisdomResponse[]>([]);
  const searchRequestId = useRef(0);

  useEffect(() => {
    const query = symbolInput.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    const timeout = window.setTimeout(async () => {
      const requestId = searchRequestId.current + 1;
      searchRequestId.current = requestId;
      setSearching(true);
      try {
        const response = await searchCompanies(query, 8);
        if (searchRequestId.current !== requestId) return;
        setSuggestions(response);
      } catch {
        if (searchRequestId.current !== requestId) return;
        setSuggestions([]);
      } finally {
        if (searchRequestId.current !== requestId) return;
        setSearching(false);
      }
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [symbolInput]);

  async function onSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    const symbol = symbolInput.trim().toUpperCase();
    if (!symbol) return;

    setLoading(true);
    setError(null);
    setSuggestions([]);
    try {
      const response = await getCrowdWisdom(symbol);
      setSelectedCompany(response);
      setScannedCompanies((previous) => {
        const next = previous.filter((item) => item.symbol !== response.symbol);
        return [...next, response];
      });
    } catch (e) {
      setSelectedCompany(null);
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  const divergenceLeaders = useMemo(
    () =>
      [...scannedCompanies]
        .sort((a, b) => Math.abs(b.divergence) - Math.abs(a.divergence))
        .slice(0, 10),
    [scannedCompanies],
  );

  const retailSentiment = selectedCompany ? sentimentSummary(selectedCompany.retailBullish) : null;
  const insiderSentiment = selectedCompany ? sentimentSummary(selectedCompany.insiderBuying) : null;
  const divergenceValue = selectedCompany ? Math.abs(selectedCompany.divergence) : 0;
  const hasLargeDivergence = divergenceValue >= DIVERGENCE_GOLD_THRESHOLD;
  const signalLabel = selectedCompany
    ? selectedCompany.signal === "CONTRARIAN_BUY"
      ? t("crowdwisdom.signalBuy", { defaultValue: "Signal: Contrarian buy" })
      : selectedCompany.signal === "CONTRARIAN_SELL"
        ? t("crowdwisdom.signalSell", { defaultValue: "Signal: Contrarian sell" })
        : t("crowdwisdom.signalNeutral", { defaultValue: "Signal: Neutral" })
    : "";
  const signalClass =
    selectedCompany?.signal === "CONTRARIAN_BUY"
      ? "inline-flex rounded-full border border-terminal-positive/40 bg-terminal-positive/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-terminal-positive"
      : selectedCompany?.signal === "CONTRARIAN_SELL"
        ? "inline-flex rounded-full border border-terminal-negative/40 bg-terminal-negative/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-terminal-negative"
        : "inline-flex rounded-full border border-terminal-borderMuted bg-terminal-panelSecondary px-3 py-1 text-xs font-semibold uppercase tracking-wide text-terminal-textSecondary";

  return (
    <div className={TERMINAL_INTELLIGENCE_PAGE}>
      <div className={TERMINAL_INTELLIGENCE_PAGE_INNER}>
        <header className="space-y-2">
          <h1 className={TERMINAL_PAGE_TITLE}>{t("crowdwisdom.title", { defaultValue: "Crowd Wisdom Inverter" })}</h1>
          <p className={TERMINAL_PAGE_SUBTITLE}>
            {t("crowdwisdom.heroSubtitle", {
              defaultValue: "Compare retail sentiment with insider activity and surface the largest divergences.",
            })}
          </p>
        </header>

        <form onSubmit={onSubmit} className={`${TERMINAL_PREDICTOR_PANEL} relative`}>
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <label className="relative flex-1 text-sm">
              <span className="mb-2 block font-semibold text-terminal-textSecondary">
                {t("crowdwisdom.searchStocks", { defaultValue: "Search companies" })}
              </span>
              <input
                value={symbolInput}
                onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => {
                  window.setTimeout(() => setIsInputFocused(false), 120);
                }}
                placeholder={t("crowdwisdom.searchPlaceholder", { defaultValue: "AAPL / PKN / MSFT" })}
                className={TERMINAL_INPUT}
              />
              {suggestions.length > 0 && isInputFocused ? (
                <ul className={`${TERMINAL_SEARCH_DROPDOWN} max-h-64 overflow-y-auto`}>
                  {suggestions.map((company) => (
                    <li key={`${company.symbol}-${company.name}`}>
                      <button
                        type="button"
                        className="flex w-full items-start justify-between gap-2 px-3 py-2 text-left text-sm text-terminal-text transition-colors hover:bg-terminal-panelSecondary"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setSymbolInput(company.symbol);
                          setSuggestions([]);
                          setIsInputFocused(false);
                        }}
                      >
                        <span className="font-semibold text-terminal-cyan">{company.symbol}</span>
                        <span className="truncate text-terminal-textSecondary">{company.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </label>

            <button type="submit" disabled={loading} className={TERMINAL_BUTTON_PRIMARY}>
              {loading ? t("common.loading") : t("crowdwisdom.analyze", { defaultValue: "Analyze" })}
            </button>
          </div>
          {searching ? (
            <p className="mt-2 text-xs text-terminal-textMuted">
              {t("crowdwisdom.searching", { defaultValue: "Searching companies..." })}
            </p>
          ) : null}
        </form>

        {error ? <div className={TERMINAL_DANGER_PANEL}>{error}</div> : null}

        {selectedCompany && retailSentiment && insiderSentiment ? (
          <section className={TERMINAL_INTELLIGENCE_PANEL}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-2xl font-semibold text-terminal-cyan">{selectedCompany.symbol}</h2>
              <span
                className={`rounded-full px-4 py-1.5 text-sm font-bold ${
                  hasLargeDivergence
                    ? "border border-amber-400/40 bg-amber-500/15 text-amber-200"
                    : "border border-terminal-cyan/35 bg-terminal-cyan/10 text-terminal-cyan"
                }`}
              >
                Divergence score: {formatDivergence(selectedCompany.divergence)}
              </span>
            </div>

            <span className={`mb-4 ${signalClass}`}>{signalLabel}</span>

            <div className={`${TERMINAL_INTELLIGENCE_GRID} md:grid-cols-3`}>
              <SentimentCard title="Retail sentiment" sentiment={retailSentiment} />
              <SentimentCard title="Insider sentiment" sentiment={insiderSentiment} />

              <article className={TERMINAL_SCORE_TILE}>
                <p className="text-sm font-semibold uppercase tracking-wide text-terminal-textSecondary">Divergence</p>
                <p className={`mt-3 text-4xl font-bold ${hasLargeDivergence ? "text-amber-300" : "text-terminal-cyan"}`}>
                  {formatDivergence(selectedCompany.divergence)}
                </p>
                <p className="mt-2 text-sm text-terminal-textSecondary">
                  {hasLargeDivergence
                    ? t("crowdwisdom.largeDivergence", { defaultValue: "Large sentiment divergence." })
                    : t("crowdwisdom.normalDivergence", { defaultValue: "Divergence within normal range." })}
                </p>
              </article>
            </div>

            <p className={`mt-4 ${TERMINAL_INFO_BANNER}`}>{selectedCompany.insight}</p>
          </section>
        ) : null}

        <section className={TERMINAL_INTELLIGENCE_PANEL}>
          <h3 className="text-lg font-semibold text-terminal-cyan">
            {t("crowdwisdom.topDivergence", { defaultValue: "Companies with the largest divergence" })}
          </h3>

          {divergenceLeaders.length === 0 ? (
            <p className="mt-3 text-sm text-terminal-textSecondary">
              {t("crowdwisdom.emptyLeaders", { defaultValue: "No data yet. Search and analyze your first company." })}
            </p>
          ) : (
            <div className={`mt-3 overflow-x-auto ${TERMINAL_DATA_TABLE}`}>
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className={TERMINAL_TABLE_HEAD}>
                    <th className="px-4 py-3 font-semibold">Ticker</th>
                    <th className="px-4 py-3 font-semibold">Retail %</th>
                    <th className="px-4 py-3 font-semibold">Insider %</th>
                    <th className="px-4 py-3 font-semibold">Divergence</th>
                  </tr>
                </thead>
                <tbody>
                  {divergenceLeaders.map((row) => {
                    const highlight = Math.abs(row.divergence) >= DIVERGENCE_GOLD_THRESHOLD;
                    return (
                      <tr key={row.symbol} className={TERMINAL_TABLE_ROW}>
                        <td className="px-4 py-3 font-semibold text-terminal-cyan">{row.symbol}</td>
                        <td className="px-4 py-3 text-terminal-text">{formatPercent(row.retailBullish)}</td>
                        <td className="px-4 py-3 text-terminal-text">{formatPercent(row.insiderBuying)}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                              highlight
                                ? "border border-amber-400/40 bg-amber-500/15 text-amber-200"
                                : "border border-terminal-borderMuted bg-terminal-panelSecondary text-terminal-textSecondary"
                            }`}
                          >
                            {formatDivergence(row.divergence)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SentimentCard(props: {
  title: string;
  sentiment: { percent: number; label: "buying" | "selling"; tone: "positive" | "negative" };
}) {
  const toneClass = props.sentiment.tone === "positive" ? "text-terminal-positive" : "text-terminal-negative";
  const badgeClass =
    props.sentiment.tone === "positive"
      ? "inline-flex rounded-full border border-terminal-positive/40 bg-terminal-positive/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-terminal-positive"
      : "inline-flex rounded-full border border-terminal-negative/40 bg-terminal-negative/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-terminal-negative";

  return (
    <article className={TERMINAL_INTELLIGENCE_CARD}>
      <p className="text-sm font-semibold uppercase tracking-wide text-terminal-textSecondary">{props.title}</p>
      <p className={`mt-3 text-5xl font-bold leading-none ${toneClass}`}>{props.sentiment.percent.toFixed(1)}%</p>
      <span className={`mt-3 ${badgeClass}`}>{props.sentiment.label}</span>
    </article>
  );
}
