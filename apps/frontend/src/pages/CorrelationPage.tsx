import { FormEvent, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { analyzeCorrelation, type CorrelationAnalyzeResponse } from "../services/api";
import {
  TERMINAL_BUTTON_PRIMARY,
  TERMINAL_DANGER_PANEL,
  TERMINAL_FORM_LABEL,
  TERMINAL_INPUT,
  TERMINAL_PAGE_SUBTITLE,
  TERMINAL_PAGE_TITLE,
  TERMINAL_TOOL_HERO,
  TERMINAL_TOOL_PAGE,
  TERMINAL_TOOL_PAGE_INNER,
  TERMINAL_TOOL_PANEL,
  TERMINAL_WARNING_PANEL,
} from "../components/terminal/terminalStyles";
import { apiErrorMessage } from "../utils/apiErrorMessage";

const MARKET_UNIVERSE = [
  { ticker: "MSFT", sector: "Technology" },
  { ticker: "XOM", sector: "Energy" },
  { ticker: "NVDA", sector: "Technology" },
  { ticker: "JPM", sector: "Financials" },
  { ticker: "PFE", sector: "Healthcare" },
  { ticker: "CAT", sector: "Industrials" },
  { ticker: "AMZN", sector: "Consumer Discretionary" },
  { ticker: "TTE", sector: "Energy" },
] as const;

const MATRIX_PLACEHOLDER = [
  [1, 0.62, -0.31, 0.08, 0.41],
  [0.62, 1, -0.12, 0.27, 0.36],
  [-0.31, -0.12, 1, -0.44, 0.11],
  [0.08, 0.27, -0.44, 1, -0.29],
  [0.41, 0.36, 0.11, -0.29, 1],
] as const;

type CorrelatedTableRow = {
  ticker: string;
  correlation: number;
  sector: string;
  warning: string;
  highRisk: boolean;
};

function matrixColor(value: number): string {
  if (value > 0.2) return "rgba(0, 168, 107, 0.18)";
  if (value < -0.2) return "rgba(229, 57, 53, 0.18)";
  return "rgba(90, 90, 122, 0.12)";
}

function correlationTextClass(value: number): string {
  if (value > 0.2) return "text-terminal-positive";
  if (value < -0.2) return "text-terminal-negative";
  return "text-terminal-textMuted";
}

export function CorrelationPage() {
  const { t } = useTranslation();
  const [symbolInput, setSymbolInput] = useState("AAPL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CorrelationAnalyzeResponse | null>(null);

  const matrixTickers = useMemo(
    () => [symbolInput.trim().toUpperCase() || "BASE", ...MARKET_UNIVERSE.slice(0, 4).map((item) => item.ticker)],
    [symbolInput],
  );

  const correlatedRows = useMemo<CorrelatedTableRow[]>(() => {
    if (data?.correlations.length) {
      return data.correlations.slice(0, 8).map((row) => ({
        ticker: row.symbol,
        correlation: row.correlation,
        sector: MARKET_UNIVERSE.find((item) => item.ticker === row.symbol)?.sector ?? "Unknown",
        highRisk: Boolean(row.warning),
        warning: row.warning
          ? t("correlation.warningHighConcentration", { defaultValue: "High concentration risk" })
          : t("correlation.warningBalanced", { defaultValue: "Balanced exposure" }),
      }));
    }

    return [
      {
        ticker: "MSFT",
        correlation: 0.74,
        sector: "Technology",
        highRisk: true,
        warning: t("correlation.warningHighConcentration", { defaultValue: "High concentration risk" }),
      },
      {
        ticker: "XOM",
        correlation: 0.52,
        sector: "Energy",
        highRisk: false,
        warning: t("correlation.warningMonitor", { defaultValue: "Monitor exposure" }),
      },
      {
        ticker: "PFE",
        correlation: 0.18,
        sector: "Healthcare",
        highRisk: false,
        warning: t("correlation.warningBalanced", { defaultValue: "Balanced exposure" }),
      },
      {
        ticker: "JPM",
        correlation: -0.22,
        sector: "Financials",
        highRisk: false,
        warning: t("correlation.warningDiversifying", { defaultValue: "Diversifying pair" }),
      },
      {
        ticker: "CAT",
        correlation: 0.34,
        sector: "Industrials",
        highRisk: false,
        warning: t("correlation.warningMonitor", { defaultValue: "Monitor exposure" }),
      },
    ];
  }, [data, t]);

  const concentrationWarning =
    data?.highRiskPairs.length && data.highRiskPairs.length > 0
      ? t("correlation.concentrationDetected", {
          count: data.highRiskPairs.length,
          defaultValue:
            "Detected {{count}} highly correlated pair(s). Consider rebalancing to reduce concentration risk.",
        })
      : t("correlation.concentrationDefault", {
          defaultValue:
            "Concentration warning: avoid overexposure to one sector by keeping highly correlated positions below 35% of portfolio weight.",
        });

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const symbol = symbolInput.trim().toUpperCase();
    if (!symbol) {
      setError("Base symbol is required.");
      setData(null);
      return;
    }

    const portfolio = MARKET_UNIVERSE.map((item) => item.ticker).filter((ticker) => ticker !== symbol);
    setLoading(true);
    setError(null);
    try {
      const response = await analyzeCorrelation({ symbol, portfolio });
      setData(response);
    } catch (e) {
      setData(null);
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={TERMINAL_TOOL_PAGE}>
      <div className={TERMINAL_TOOL_PAGE_INNER}>
      <header className={TERMINAL_TOOL_HERO}>
        <h1 className={TERMINAL_PAGE_TITLE}>{t("correlation.title", { defaultValue: "Correlation Scanner" })}</h1>
        <p className={`${TERMINAL_PAGE_SUBTITLE} mt-2`}>
          {t("correlation.subtitle", {
            defaultValue: "Check Pearson correlation between your main ticker and portfolio symbols.",
          })}
        </p>
      </header>

      <form onSubmit={onSubmit} className={`${TERMINAL_TOOL_PANEL} flex flex-col gap-3 sm:flex-row sm:items-end`}>
        <label className="w-full text-sm sm:max-w-sm">
          <span className={`mb-1.5 block ${TERMINAL_FORM_LABEL}`}>
            Search base company
          </span>
          <input
            value={symbolInput}
            onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
            placeholder="AAPL"
            className={TERMINAL_INPUT}
          />
        </label>
        <button type="submit" disabled={loading} className={`${TERMINAL_BUTTON_PRIMARY} disabled:opacity-60`}>
          {loading ? t("common.loading") : t("correlation.analyze", { defaultValue: "Analyze correlation" })}
        </button>
      </form>

      {error ? <div className={TERMINAL_DANGER_PANEL}>{error}</div> : null}

      <section className={TERMINAL_TOOL_PANEL}>
        <h2 className="mb-3 text-base font-semibold text-terminal-cyan">
          Correlation matrix (placeholder)
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-[560px] border-separate border-spacing-2 text-sm">
            <thead>
              <tr>
                <th className="px-2 py-1 text-left text-xs uppercase text-terminal-textMuted">
                  Ticker
                </th>
                {matrixTickers.map((ticker) => (
                  <th key={`head-${ticker}`} className="px-2 py-1 text-center text-xs uppercase text-terminal-textMuted">
                    {ticker}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATRIX_PLACEHOLDER.map((row, rowIndex) => (
                <tr key={`row-${matrixTickers[rowIndex]}`}>
                  <th className="px-2 py-1 text-left text-xs uppercase text-terminal-textMuted">
                    {matrixTickers[rowIndex]}
                  </th>
                  {row.map((value, colIndex) => (
                    <td
                      key={`${rowIndex}-${colIndex}`}
                      className={`rounded-lg border border-terminal-borderMuted px-3 py-2 text-center font-mono text-xs ${correlationTextClass(value)}`}
                      style={{
                        backgroundColor: matrixColor(value),
                      }}
                    >
                      {(value * 100).toFixed(0)}%
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={TERMINAL_TOOL_PANEL}>
        <h2 className="mb-3 text-base font-semibold text-terminal-cyan">
          Correlated companies
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-terminal-border">
                <th className="py-2 pr-4 text-xs uppercase text-terminal-textMuted">
                  Ticker
                </th>
                <th className="py-2 pr-4 text-xs uppercase text-terminal-textMuted">
                  {t("correlation.colCorrelationPct", { defaultValue: "Correlation %" })}
                </th>
                <th className="py-2 pr-4 text-xs uppercase text-terminal-textMuted">
                  {t("correlation.colSector", { defaultValue: "Sector" })}
                </th>
                <th className="py-2 text-xs uppercase text-terminal-textMuted">
                  {t("correlation.colWarning", { defaultValue: "Warning" })}
                </th>
              </tr>
            </thead>
            <tbody>
              {correlatedRows.map((row) => (
                <tr key={row.ticker} className="border-b border-terminal-borderMuted last:border-b-0">
                  <td className="py-3 pr-4 font-semibold text-terminal-cyan">
                    {row.ticker}
                  </td>
                  <td className={`py-3 pr-4 font-mono ${correlationTextClass(row.correlation)}`}>
                    {(row.correlation * 100).toFixed(1)}%
                  </td>
                  <td className="py-3 pr-4 text-terminal-textSecondary">
                    {row.sector}
                  </td>
                  <td className="py-3">
                    <span
                      className={`rounded-full border px-2 py-1 text-xs font-medium ${
                        row.highRisk
                          ? "border-terminal-negative/40 bg-terminal-negative/10 text-terminal-negative"
                          : "border-terminal-borderMuted bg-terminal-panelSecondary text-terminal-textMuted"
                      }`}
                    >
                      {row.warning}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={TERMINAL_WARNING_PANEL}>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-terminal-cyan">
          {t("correlation.concentrationTitle", { defaultValue: "Concentration warning" })}
        </h3>
        <p className="text-sm leading-6 text-terminal-textSecondary">
          {concentrationWarning}
        </p>
      </section>

      {data?.insight ? (
        <section className={TERMINAL_TOOL_PANEL}>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-terminal-cyan">
            Insight
          </h3>
          <p className="text-sm leading-6 text-terminal-textSecondary">
            {data.insight}
          </p>
        </section>
      ) : null}
      </div>
    </div>
  );
}
