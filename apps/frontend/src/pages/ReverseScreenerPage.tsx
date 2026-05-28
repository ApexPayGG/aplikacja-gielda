import { useState } from "react";
import { useTranslation } from "react-i18next";
import { findReverseScreenerSetups, type ReverseScreenerFindResponse } from "../services/api";
import {
  TERMINAL_BUTTON_PRIMARY,
  TERMINAL_DANGER_PANEL,
  TERMINAL_EMPTY_STATE,
  TERMINAL_FORM_LABEL,
  TERMINAL_INPUT,
  TERMINAL_INTELLIGENCE_CARD,
  TERMINAL_INTELLIGENCE_PAGE,
  TERMINAL_INTELLIGENCE_PAGE_INNER,
  TERMINAL_PAGE_SUBTITLE,
  TERMINAL_PAGE_TITLE,
  TERMINAL_PREDICTOR_PANEL,
} from "../components/terminal/terminalStyles";
import { apiErrorMessage } from "../utils/apiErrorMessage";

function formatPct(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatFollowUp(outcome5d: number, outcome10d: number): string {
  return `5D: ${formatPct(outcome5d)} | 10D: ${formatPct(outcome10d)}`;
}

export function ReverseScreenerPage() {
  const { t } = useTranslation();
  const [symbol, setSymbol] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReverseScreenerFindResponse | null>(null);

  async function onFind() {
    const normalizedSymbol = symbol.trim().toUpperCase();
    if (!normalizedSymbol) {
      setError(t("reverseScreenerPage.errorTickerRequired", { defaultValue: "Enter a ticker to start the search." }));
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await findReverseScreenerSetups({ symbol: normalizedSymbol });
      setResult(data);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  const displaySymbol = symbol.trim().toUpperCase() || "ticker";

  return (
    <div className={TERMINAL_INTELLIGENCE_PAGE}>
      <div className={TERMINAL_INTELLIGENCE_PAGE_INNER}>
        <header className="space-y-2">
          <h1 className={TERMINAL_PAGE_TITLE}>Reverse Screener</h1>
          <p className={TERMINAL_PAGE_SUBTITLE}>
            {t("reverseScreenerPage.introSimilarSetups", {
              defaultValue: "Historical setups similar to today's candle shape and volume.",
            })}
          </p>
          <p className="text-sm font-medium text-terminal-cyan">
            {t("reverseScreenerPage.promptWhichLookedSame", {
              symbol: displaySymbol,
              defaultValue: "Which stocks historically looked the same as {{symbol}} today?",
            })}
          </p>
        </header>

        <section className={TERMINAL_PREDICTOR_PANEL}>
          <label className={TERMINAL_FORM_LABEL} htmlFor="rs-symbol">
            Search ticker input
          </label>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              id="rs-symbol"
              className={`h-11 flex-1 ${TERMINAL_INPUT}`}
              placeholder={t("reverseScreenerPage.tickerPlaceholder", { defaultValue: "e.g. AAPL" })}
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              autoCapitalize="characters"
            />
            <button
              type="button"
              className={`h-11 ${TERMINAL_BUTTON_PRIMARY}`}
              disabled={loading}
              onClick={() => void onFind()}
            >
              {loading ? t("common.loading") : t("reverseScreenerPage.findSimilar", { defaultValue: "Find similar" })}
            </button>
          </div>
        </section>

        {error ? <div className={TERMINAL_DANGER_PANEL}>{error}</div> : null}

        {result ? (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-terminal-cyan">
                {t("reverseScreenerPage.resultsHeading", { defaultValue: "Results" })}
              </h2>
              <span className="text-sm text-terminal-textSecondary">
                {t("reverseScreenerPage.avgOutcomeLabel", { defaultValue: "Average outcome:" })}{" "}
                <strong className="text-terminal-text">{formatPct(result.avgOutcome)}</strong>
              </span>
            </div>

            {result.matches.length === 0 ? (
              <p className={TERMINAL_EMPTY_STATE}>
                {t("reverseScreenerPage.emptyMatches", { defaultValue: "No matches for this ticker." })}
              </p>
            ) : (
              <ul className="space-y-3">
                {result.matches.map((match) => (
                  <li key={`${match.symbol}-${match.date}`} className={TERMINAL_INTELLIGENCE_CARD}>
                    <div className="grid gap-3 text-sm md:grid-cols-[1fr_1fr_auto_2fr] md:items-center">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-terminal-textMuted">Ticker</p>
                        <p className="text-lg font-bold text-terminal-cyan">{match.symbol}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-terminal-textMuted">Date</p>
                        <p className="font-medium text-terminal-text">{match.date}</p>
                      </div>
                      <div className="justify-self-start md:justify-self-center">
                        <span className="inline-flex rounded-full border border-terminal-cyan/35 bg-terminal-cyan/10 px-3 py-1 text-xs font-semibold text-terminal-cyan">
                          Similarity {match.similarity.toFixed(1)}%
                        </span>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-terminal-textMuted">
                          {t("reverseScreenerPage.followUpHeading", {
                            defaultValue: "What happened next",
                          })}
                        </p>
                        <p className="font-medium text-terminal-textSecondary">
                          {formatFollowUp(match.outcome5d, match.outcome10d)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}
