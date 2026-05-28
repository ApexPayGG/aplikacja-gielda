import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  evaluateReplayDecision,
  getReplaySnapshot,
  type ReplayAction,
  type ReplayEvaluateResponse,
  type ReplaySnapshotResponse,
  searchCompanies,
} from "../services/api";
import {
  TERMINAL_BUTTON_PRIMARY,
  TERMINAL_DANGER_PANEL,
  TERMINAL_INFO_BANNER,
  TERMINAL_INPUT,
  TERMINAL_PAGE_SUBTITLE,
  TERMINAL_PAGE_TITLE,
  TERMINAL_REPLAY_PANEL,
  TERMINAL_INTELLIGENCE_CARD,
  TERMINAL_INTELLIGENCE_PAGE,
  TERMINAL_INTELLIGENCE_PAGE_INNER,
  TERMINAL_INTELLIGENCE_PANEL,
} from "../components/terminal/terminalStyles";
import { apiErrorMessage } from "../utils/apiErrorMessage";

const SYMBOL_OPTIONS = ["PKN", "KGH", "PKO", "PZU", "PEO", "LPP", "CDR"];
const USER_ID = window.localStorage.getItem("userId")?.trim() || "";
type ReplayDecision = ReplayAction | "SKIP";

function formatPrice(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

export function ReplayModePage() {
  const { t } = useTranslation();
  const [symbolInput, setSymbolInput] = useState("PKN");
  const [symbolOptions, setSymbolOptions] = useState<string[]>(SYMBOL_OPTIONS);
  const [date, setDate] = useState("");
  const [snapshot, setSnapshot] = useState<ReplaySnapshotResponse | null>(null);
  const [reason, setReason] = useState("");
  const [selectedDecision, setSelectedDecision] = useState<ReplayDecision | null>(null);
  const [evaluation, setEvaluation] = useState<ReplayEvaluateResponse | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [loadingEvaluation, setLoadingEvaluation] = useState(false);
  const [loadingSymbols, setLoadingSymbols] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxReplayDate = useMemo(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().slice(0, 10);
  }, []);

  useEffect(() => {
    const query = symbolInput.trim();
    if (!query) {
      setSymbolOptions(SYMBOL_OPTIONS);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setLoadingSymbols(true);
      try {
        const companies = await searchCompanies(query, 8);
        if (cancelled) return;
        const remoteSymbols = companies
          .map((row) => row.symbol?.trim().toUpperCase())
          .filter((item): item is string => Boolean(item));
        const merged = Array.from(new Set([query.toUpperCase(), ...remoteSymbols, ...SYMBOL_OPTIONS]));
        setSymbolOptions(merged.slice(0, 12));
      } catch {
        if (!cancelled) {
          setSymbolOptions(Array.from(new Set([query.toUpperCase(), ...SYMBOL_OPTIONS])));
        }
      } finally {
        if (!cancelled) {
          setLoadingSymbols(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [symbolInput]);

  async function onLoadSnapshot(event: React.FormEvent) {
    event.preventDefault();
    const normalizedSymbol = symbolInput.trim().toUpperCase();
    if (!normalizedSymbol) {
      setError(t("replayModePage.errorSymbolRequired", { defaultValue: "Enter a ticker symbol." }));
      return;
    }

    setError(null);
    setEvaluation(null);
    setSelectedDecision(null);
    setReason("");
    setLoadingSnapshot(true);
    try {
      const next = await getReplaySnapshot(normalizedSymbol, date);
      setSnapshot(next);
    } catch (e) {
      setSnapshot(null);
      setError(apiErrorMessage(e));
    } finally {
      setLoadingSnapshot(false);
    }
  }

  async function onDecide(decision: ReplayDecision) {
    if (!snapshot) return;
    setError(null);
    setSelectedDecision(decision);

    if (decision === "SKIP") {
      const trimmed = reason.trim();
      const explanation =
        trimmed.length > 0
          ? t("replayModePage.skipExplained", {
              reason: trimmed,
              defaultValue: "Skip justified: {{reason}}",
            })
          : t("replayModePage.skipNeutral", {
              defaultValue: "Skipping can be a good idea when the setup does not match your checklist.",
            });
      setEvaluation({
        score: 6,
        explanation,
        actualOutcome: snapshot.priceChange5d,
      });
      return;
    }

    setLoadingEvaluation(true);
    try {
      const result = await evaluateReplayDecision({
        userId: USER_ID,
        symbol: snapshot.symbol,
        date: snapshot.date,
        action: decision,
        price: Number(snapshot.close),
      });
      setEvaluation(result);
    } catch (e) {
      setEvaluation(null);
      setError(apiErrorMessage(e));
    } finally {
      setLoadingEvaluation(false);
    }
  }

  function decisionVerb(action: ReplayDecision | null): string {
    if (action === "BUY") return t("replayModePage.buy", { defaultValue: "Buy" });
    if (action === "SELL") return t("replayModePage.sell", { defaultValue: "Sell" });
    return t("replayModePage.skip", { defaultValue: "Skip" });
  }

  return (
    <div className={TERMINAL_INTELLIGENCE_PAGE}>
      <div className={`${TERMINAL_INTELLIGENCE_PAGE_INNER} max-w-6xl`}>
        <header className={TERMINAL_INTELLIGENCE_PANEL}>
          <h1 className={TERMINAL_PAGE_TITLE}>Replay Mode</h1>
          <p className={`mt-2 ${TERMINAL_PAGE_SUBTITLE}`}>
            {t("replayModePage.subtitle", {
              defaultValue: 'Step back in time and play "what would I do"',
            })}
          </p>
        </header>

        {error ? <div className={TERMINAL_DANGER_PANEL}>{error}</div> : null}

        <section className={TERMINAL_REPLAY_PANEL}>
          <form onSubmit={onLoadSnapshot} className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-terminal-textMuted">
                {t("replayModePage.symbolSearchHint", { defaultValue: "Symbol search" })}
              </span>
              <input
                list="replay-symbols"
                type="search"
                value={symbolInput}
                onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
                placeholder={t("replayModePage.companySearchPlaceholder", { defaultValue: "Search for a company…" })}
                className={TERMINAL_INPUT}
                required
              />
              <datalist id="replay-symbols">
                {symbolOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </datalist>
              <span className="text-xs text-terminal-textMuted">
                {loadingSymbols
                  ? t("replayModePage.searchingSymbols", { defaultValue: "Searching symbols…" })
                  : t("replayModePage.symbolTickerOrNameHint", { defaultValue: "Enter a ticker or name" })}
              </span>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-terminal-textMuted">
                {t("replayModePage.datePickerHint", { defaultValue: "Date picker" })}
              </span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                max={maxReplayDate}
                className={TERMINAL_INPUT}
                required
              />
            </label>

            <div className="flex items-end">
              <button type="submit" disabled={loadingSnapshot} className={`w-full ${TERMINAL_BUTTON_PRIMARY}`}>
                {loadingSnapshot
                  ? t("replayModePage.loading", { defaultValue: "Loading..." })
                  : t("replayModePage.historyLoad", { defaultValue: "Load history" })}
              </button>
            </div>
          </form>
        </section>

        {snapshot ? (
          <section className="grid gap-5 md:grid-cols-[1.45fr_1fr]">
            <article className={`flex min-h-[360px] items-center justify-center ${TERMINAL_INTELLIGENCE_CARD} text-center`}>
              <div>
                <p className="text-sm font-medium text-terminal-textMuted">
                  {t("replayModePage.chartHistorical", { defaultValue: "Historical chart" })}
                </p>
                <p className="mt-2 text-xs text-terminal-textMuted">
                  {snapshot.symbol} • {snapshot.date}
                </p>
              </div>
            </article>

            <aside className={TERMINAL_REPLAY_PANEL}>
              <p className="text-sm font-semibold text-terminal-cyan">
                {t("replayModePage.decisionPanel", { defaultValue: "Decision panel" })}
              </p>
              <div className={`mt-4 ${TERMINAL_INTELLIGENCE_CARD}`}>
                <p className="text-xs uppercase tracking-wide text-terminal-textMuted">
                  {t("replayModePage.priceDayLabel", { defaultValue: "Price on selected day" })}
                </p>
                <p className="mt-1 font-mono text-2xl font-bold text-terminal-text">{formatPrice(snapshot.close)}</p>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => void onDecide("BUY")}
                  disabled={loadingEvaluation}
                  className="rounded-lg bg-terminal-positive px-3 py-2 text-sm font-semibold text-terminal-buttonText transition hover:brightness-110 disabled:opacity-60"
                >
                  {t("replayModePage.buy", { defaultValue: "Buy" })}
                </button>
                <button
                  type="button"
                  onClick={() => void onDecide("SELL")}
                  disabled={loadingEvaluation}
                  className="rounded-lg bg-terminal-negative px-3 py-2 text-sm font-semibold text-terminal-buttonText transition hover:brightness-110 disabled:opacity-60"
                >
                  {t("replayModePage.sell", { defaultValue: "Sell" })}
                </button>
                <button
                  type="button"
                  onClick={() => void onDecide("SKIP")}
                  disabled={loadingEvaluation}
                  className="rounded-lg border border-terminal-borderMuted bg-terminal-panelSecondary px-3 py-2 text-sm font-semibold text-terminal-textMuted transition hover:border-terminal-cyan/35 disabled:opacity-60"
                >
                  {t("replayModePage.skip", { defaultValue: "Skip" })}
                </button>
              </div>

              <label className="mt-4 block text-sm">
                <span className="font-medium text-terminal-textMuted">
                  {t("replayModePage.whyLabel", { defaultValue: "Why?" })}
                </span>
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={5}
                  placeholder={t("replayModePage.thinkingPlaceholder", {
                    defaultValue: "Describe your thought process…",
                  })}
                  className={`mt-1 min-h-[88px] ${TERMINAL_INPUT}`}
                />
              </label>

              {loadingEvaluation ? (
                <p className="mt-3 text-xs text-terminal-textMuted">{t("replayModePage.aiAnalyzing", { defaultValue: "Analyzing decision..." })}</p>
              ) : null}
            </aside>
          </section>
        ) : null}

        {evaluation ? (
          <section className={TERMINAL_INFO_BANNER}>
            <h2 className="text-lg font-semibold text-terminal-cyan">AI Feedback</h2>
            <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
              <p>
                <span className="text-terminal-textMuted">{t("replayModePage.decisionLabel", { defaultValue: "Decision:" })} </span>
                <span className="font-semibold text-terminal-text">{decisionVerb(selectedDecision)}</span>
              </p>
              <p>
                <span className="text-terminal-textMuted">Score:</span>{" "}
                <span className="font-semibold text-terminal-text">{evaluation.score}/10</span>
              </p>
              <p>
                <span className="text-terminal-textMuted">{t("replayModePage.actualOutcomeLabel", { defaultValue: "Realized outcome:" })}{" "}</span>
                <span className="font-semibold text-terminal-text">
                  {evaluation.actualOutcome >= 0 ? "+" : ""}
                  {evaluation.actualOutcome.toFixed(2)}%
                </span>
              </p>
            </div>
            <p className="mt-2 text-sm text-terminal-textSecondary">{evaluation.explanation}</p>
          </section>
        ) : null}
      </div>
    </div>
  );
}
