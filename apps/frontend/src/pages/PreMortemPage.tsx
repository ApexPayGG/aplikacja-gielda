import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { runPreMortem, type PreMortemResponse } from "../services/api";
import {
  TERMINAL_BUTTON_PRIMARY,
  TERMINAL_FORM_LABEL,
  TERMINAL_INPUT,
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
const PLN_PER_USD = 3.95;

const HORIZON_OPTIONS = [
  { months: 3, labelKey: "premortem.horizon3m", labelDefault: "3 months", riskPct: 0.08, rewardPct: 0.15 },
  { months: 6, labelKey: "premortem.horizon6m", labelDefault: "6 months", riskPct: 0.12, rewardPct: 0.24 },
  { months: 12, labelKey: "premortem.horizon12m", labelDefault: "12 months", riskPct: 0.18, rewardPct: 0.35 },
] as const;

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value / PLN_PER_USD);
}

function pickHorizon(months: number) {
  return HORIZON_OPTIONS.find((option) => option.months === months) ?? HORIZON_OPTIONS[1];
}

export function PreMortemPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({
    ticker: "",
    entryPrice: "",
    quantity: "1",
    horizonMonths: 6,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PreMortemResponse | null>(null);
  const [prefillNote, setPrefillNote] = useState<string | null>(null);

  useEffect(() => {
    const symbol = searchParams.get("symbol");
    const entry = searchParams.get("entry");
    const quantity = searchParams.get("quantity");
    const horizon = Number(searchParams.get("horizonMonths"));
    const regime = searchParams.get("regime");
    if (symbol || entry || quantity || Number.isFinite(horizon)) {
      setForm((prev) => ({
        ticker: symbol?.trim().toUpperCase() || prev.ticker,
        entryPrice: entry != null && entry !== "" ? entry : prev.entryPrice,
        quantity: quantity != null && quantity !== "" ? quantity : prev.quantity,
        horizonMonths: HORIZON_OPTIONS.some((option) => option.months === horizon)
          ? horizon
          : prev.horizonMonths,
      }));
    }
    setPrefillNote(
      regime
        ? t("premortem.prefillRegime", { regime, defaultValue: `Market regime from prefill: ${regime}` })
        : null,
    );
  }, [searchParams, t]);

  const selectedHorizon = useMemo(() => pickHorizon(form.horizonMonths), [form.horizonMonths]);

  const projectedGain = useMemo(() => {
    if (!result) return 0;
    const multiplier = selectedHorizon.rewardPct / selectedHorizon.riskPct;
    return Math.abs(result.maxLoss) * multiplier;
  }, [result, selectedHorizon.riskPct, selectedHorizon.rewardPct]);

  const aiNarrative = useMemo(() => {
    if (!result) return "";
    return t("premortem.aiNarrative", {
      ticker: form.ticker || "selected symbol",
      regime: result.marketRegime,
      horizon: t(selectedHorizon.labelKey, { defaultValue: selectedHorizon.labelDefault }),
      defaultValue: `AI expects ${form.ticker || "the symbol"} in a ${result.marketRegime} regime to show volatility first — stay disciplined for the ${selectedHorizon.labelDefault} horizon.`,
    });
  }, [form.ticker, result, selectedHorizon, t]);

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const entry = Number(form.entryPrice);
    const quantity = Number(form.quantity);
    if (!form.ticker.trim() || !Number.isFinite(entry) || entry <= 0 || !Number.isFinite(quantity) || quantity <= 0) {
      setError(t("premortem.formError", { defaultValue: "Fill in all form fields with valid values." }));
      return;
    }

    const stopLoss = entry * (1 - selectedHorizon.riskPct);
    const takeProfit = entry * (1 + selectedHorizon.rewardPct);
    setLoading(true);
    setError(null);
    try {
      const response = await runPreMortem({
        symbol: form.ticker.trim().toUpperCase(),
        entry,
        stopLoss,
        takeProfit,
        quantity,
        userId: USER_ID,
      });
      setResult(response);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={TERMINAL_TOOL_PAGE}>
      <div className={`${TERMINAL_TOOL_PAGE_INNER} max-w-5xl`}>
        <header className={TERMINAL_TOOL_HERO}>
          <h1 className={TERMINAL_PAGE_TITLE}>{t("premortem.title", { defaultValue: "Pre-Mortem AI" })}</h1>
          <p className={`${TERMINAL_PAGE_SUBTITLE} mt-2`}>
            {t("premortem.pageSubtitle", {
              defaultValue: "Before entering a position, stress-test downside and upside scenarios.",
            })}
          </p>
        </header>

        {prefillNote ? (
          <div className={`${TERMINAL_TOOL_PANEL} text-sm text-terminal-textMuted`}>{prefillNote}</div>
        ) : null}

        <form onSubmit={onSubmit} className={TERMINAL_TOOL_PANEL}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className={TERMINAL_FORM_LABEL}>{t("premortem.symbol", { defaultValue: "Ticker" })}</span>
              <input
                value={form.ticker}
                onChange={(event) => setForm((prev) => ({ ...prev, ticker: event.target.value.toUpperCase() }))}
                placeholder="AAPL"
                className={TERMINAL_INPUT}
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className={TERMINAL_FORM_LABEL}>{t("premortem.entry", { defaultValue: "Entry price" })}</span>
              <input
                type="number"
                step="0.01"
                value={form.entryPrice}
                onChange={(event) => setForm((prev) => ({ ...prev, entryPrice: event.target.value }))}
                className={TERMINAL_INPUT}
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className={TERMINAL_FORM_LABEL}>{t("premortem.quantity", { defaultValue: "Quantity" })}</span>
              <input
                type="number"
                step="1"
                min="1"
                value={form.quantity}
                onChange={(event) => setForm((prev) => ({ ...prev, quantity: event.target.value }))}
                className={TERMINAL_INPUT}
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className={TERMINAL_FORM_LABEL}>{t("premortem.timeHorizon", { defaultValue: "Time horizon" })}</span>
              <select
                value={form.horizonMonths}
                onChange={(event) => setForm((prev) => ({ ...prev, horizonMonths: Number(event.target.value) }))}
                className={TERMINAL_INPUT}
              >
                {HORIZON_OPTIONS.map((option) => (
                  <option key={option.months} value={option.months}>
                    {t(option.labelKey, { defaultValue: option.labelDefault })}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button type="submit" disabled={loading} className={`${TERMINAL_BUTTON_PRIMARY} mt-5 disabled:opacity-60`}>
            {loading
              ? t("premortem.analyzing", { defaultValue: "Analyzing..." })
              : t("premortem.analyzeRisk", { defaultValue: "Analyze risk" })}
          </button>
        </form>

        {error ? <p className="text-sm text-terminal-negative">{error}</p> : null}

        {result ? (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <article className={TERMINAL_TOOL_RESULT_CARD}>
                <p className="text-xs uppercase tracking-wide text-terminal-textMuted">{t("premortem.lossScenario", { defaultValue: "Most likely loss scenario" })}</p>
                <p className="mt-2 text-2xl font-bold text-terminal-negative">{formatCurrency(result.maxLoss)}</p>
              </article>
              <article className={TERMINAL_TOOL_RESULT_CARD}>
                <p className="text-xs uppercase tracking-wide text-terminal-textMuted">{t("premortem.marketRegime", { defaultValue: "Market Regime" })}</p>
                <p className="mt-2 text-2xl font-bold text-terminal-cyan">{result.marketRegime}</p>
              </article>
              <article className={TERMINAL_TOOL_RESULT_CARD}>
                <p className="text-xs uppercase tracking-wide text-terminal-textMuted">Upside (model)</p>
                <p className="mt-2 text-2xl font-bold text-terminal-positive">{formatCurrency(projectedGain)}</p>
              </article>
            </section>
            {aiNarrative ? (
              <section className={TERMINAL_TOOL_PANEL}>
                <p className="text-sm leading-relaxed text-terminal-textSecondary">{aiNarrative}</p>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
