import { FormEvent, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getEarningsPrediction,
  type EarningsPredictionLabel,
  type EarningsPredictionResponse,
} from "../services/api";
import {
  TERMINAL_BUTTON_PRIMARY,
  TERMINAL_DANGER_PANEL,
  TERMINAL_DATA_TABLE,
  TERMINAL_INPUT,
  TERMINAL_INTELLIGENCE_CARD,
  TERMINAL_INTELLIGENCE_PAGE,
  TERMINAL_INTELLIGENCE_PAGE_INNER,
  TERMINAL_INTELLIGENCE_PANEL,
  TERMINAL_PAGE_SUBTITLE,
  TERMINAL_PAGE_TITLE,
  TERMINAL_PREDICTOR_PANEL,
  TERMINAL_TABLE_HEAD,
  TERMINAL_TABLE_ROW,
} from "../components/terminal/terminalStyles";
import { apiErrorMessage } from "../utils/apiErrorMessage";

function predictionBadgeClass(prediction: EarningsPredictionLabel): string {
  if (prediction === "BEAT") {
    return "rounded-full border border-terminal-positive/40 bg-terminal-positive/10 px-4 py-1.5 text-sm font-bold tracking-wide text-terminal-positive";
  }
  if (prediction === "MISS") {
    return "rounded-full border border-terminal-negative/40 bg-terminal-negative/10 px-4 py-1.5 text-sm font-bold tracking-wide text-terminal-negative";
  }
  return "rounded-full border border-terminal-borderMuted bg-terminal-panelSecondary px-4 py-1.5 text-sm font-bold tracking-wide text-terminal-textSecondary";
}

function predictionLabel(prediction: EarningsPredictionLabel): string {
  return prediction === "IN_LINE" ? "IN-LINE" : prediction;
}

type FactorItem = {
  name: string;
  impact: number;
};

type HistoryRow = {
  quarter: string;
  prediction: string;
  accuracy: number;
};

function buildFactors(result: EarningsPredictionResponse): FactorItem[] {
  const base = Math.min(95, Math.max(45, result.confidence));
  const direction = result.prediction === "MISS" ? -1 : 1;
  const seed = result.symbol
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const offsets = [11, -7, 4, -12, 8];
  const names = [
    "Revenue momentum",
    "EPS revisions",
    "Guidance quality",
    "Macro sensitivity",
    "Options sentiment",
  ];

  return names.map((name, index) => {
    const wobble = ((seed + index * 13) % 9) - 4;
    const raw = base + direction * offsets[index] + wobble;
    return { name, impact: Math.max(20, Math.min(96, Math.round(raw))) };
  });
}

function buildHistory(result: EarningsPredictionResponse): HistoryRow[] {
  const now = new Date();
  const thisYear = now.getFullYear();
  const quarter = Math.max(1, Math.ceil((now.getMonth() + 1) / 3));
  const base = Math.min(97, Math.max(55, result.confidence));
  const labels: string[] = [];
  for (let index = 0; index < 4; index += 1) {
    const offsetQuarter = quarter - index;
    const normalizedQuarter = offsetQuarter > 0 ? offsetQuarter : 4 + offsetQuarter;
    const yearShift = offsetQuarter > 0 ? 0 : 1;
    labels.push(`Q${normalizedQuarter} ${thisYear - yearShift}`);
  }

  return labels.map((label, index) => ({
    quarter: label,
    prediction: predictionLabel(result.prediction),
    accuracy: Math.max(52, Math.min(98, Math.round(base - index * 4 + (index % 2 === 0 ? 3 : -2)))),
  }));
}

export function EarningsPredictorPage() {
  const { t } = useTranslation();
  const [symbolInput, setSymbolInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EarningsPredictionResponse | null>(null);

  const factors = useMemo(() => (result ? buildFactors(result) : []), [result]);
  const historyRows = useMemo(() => (result ? buildHistory(result) : []), [result]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const symbol = symbolInput.trim().toUpperCase();
    if (!symbol) {
      setError(t("earnings.validationSymbol", { defaultValue: "Please provide a valid symbol." }));
      setResult(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const next = await getEarningsPrediction(symbol);
      setResult(next);
    } catch (e) {
      setResult(null);
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={TERMINAL_INTELLIGENCE_PAGE}>
      <div className={TERMINAL_INTELLIGENCE_PAGE_INNER}>
        <header className="space-y-2">
          <h1 className={TERMINAL_PAGE_TITLE}>Earnings Surprise Predictor</h1>
          <p className={TERMINAL_PAGE_SUBTITLE}>
            {t("earnings.pageLead", {
              defaultValue:
                "The model predicts the surprise direction and surfaces impact factors for the next report.",
            })}
          </p>
        </header>

        <section className={TERMINAL_PREDICTOR_PANEL}>
          <form onSubmit={onSubmit} className="flex flex-col gap-3 md:flex-row">
            <input
              value={symbolInput}
              onChange={(event) => setSymbolInput(event.target.value)}
              placeholder={t("earnings.searchPlaceholderMixed", { defaultValue: "Search company (e.g. MSFT)" })}
              className={TERMINAL_INPUT}
              maxLength={16}
            />
            <button type="submit" disabled={loading} className={TERMINAL_BUTTON_PRIMARY}>
              {loading ? t("common.loading", { defaultValue: "Loading..." }) : t("earnings.predictButton", { defaultValue: "Predict" })}
            </button>
          </form>
        </section>

        {error ? <div className={TERMINAL_DANGER_PANEL}>{error}</div> : null}

        {!loading && !error && result ? (
          <section className={`space-y-6 ${TERMINAL_INTELLIGENCE_PANEL}`}>
            <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
              <article className={`flex flex-col items-center justify-center ${TERMINAL_INTELLIGENCE_CARD}`}>
                <div className="flex h-44 w-44 flex-col items-center justify-center rounded-full border border-terminal-cyan/40 bg-terminal-cyan/10 text-center shadow-terminal-glow">
                  <p className="text-xs uppercase tracking-wide text-terminal-textMuted">Prediction score</p>
                  <p className="mt-1 text-5xl font-bold text-terminal-cyan">{Math.round(result.confidence)}</p>
                  <p className="text-sm font-semibold text-terminal-textSecondary">/100</p>
                </div>
                <p className="mt-3 text-sm font-medium text-terminal-textSecondary">
                  {result.symbol} • {result.nextEarningsDate ?? "Data TBA"}
                </p>
                <span className={`mt-3 ${predictionBadgeClass(result.prediction)}`}>
                  {predictionLabel(result.prediction)}
                </span>
              </article>

              <article className={TERMINAL_INTELLIGENCE_CARD}>
                <h2 className="text-lg font-semibold text-terminal-cyan">Factors impact</h2>
                <p className="mt-1 text-xs text-terminal-textMuted">
                  {t("earnings.factorsSubtitle", {
                    defaultValue: "Simulated factors derived from the confidence score.",
                  })}
                </p>
                <ul className="mt-4 space-y-3">
                  {factors.map((factor) => (
                    <li key={factor.name}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="text-terminal-text">{factor.name}</span>
                        <span className="font-semibold text-terminal-cyan">{factor.impact}%</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-terminal-panelSecondary">
                        <div
                          className="h-full rounded-full bg-terminal-cyan"
                          style={{ width: `${factor.impact}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </article>
            </div>

            <article className={TERMINAL_INTELLIGENCE_CARD}>
              <h3 className="text-lg font-semibold text-terminal-cyan">
                {t("earnings.historyTitle", { defaultValue: "Prediction history" })}
              </h3>
              <p className="mt-1 text-xs text-terminal-textMuted">
                {t("earnings.historyAccuracyNote", { defaultValue: "Simulated model accuracy history." })}
              </p>
              <div className={`mt-3 overflow-x-auto ${TERMINAL_DATA_TABLE}`}>
                <table className="w-full min-w-[420px] text-left text-sm">
                  <thead>
                    <tr className={TERMINAL_TABLE_HEAD}>
                      <th className="px-4 py-2.5 font-semibold">{t("earnings.quarterColumn", { defaultValue: "Period" })}</th>
                      <th className="px-4 py-2.5 font-semibold">Prediction</th>
                      <th className="px-4 py-2.5 font-semibold">Accuracy %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyRows.map((row) => (
                      <tr key={row.quarter} className={TERMINAL_TABLE_ROW}>
                        <td className="px-4 py-2.5 font-semibold text-terminal-text">{row.quarter}</td>
                        <td className="px-4 py-2.5 text-terminal-textSecondary">{row.prediction}</td>
                        <td className="px-4 py-2.5 font-mono font-semibold text-terminal-cyan">{row.accuracy}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-sm text-terminal-textSecondary">{result.reasoning}</p>
            </article>
          </section>
        ) : null}
      </div>
    </div>
  );
}
