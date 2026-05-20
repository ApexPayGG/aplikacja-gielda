import { FormEvent, useMemo, useState } from "react";
import { analyzeCorrelation, type CorrelationAnalyzeResponse } from "../services/api";
import { colors } from "../styles/designSystem";
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
};

function matrixColor(value: number): string {
  if (value > 0.2) return "rgba(0, 168, 107, 0.18)";
  if (value < -0.2) return "rgba(229, 57, 53, 0.18)";
  return "rgba(90, 90, 122, 0.12)";
}

function correlationTextColor(value: number): string {
  if (value > 0.2) return colors.positive;
  if (value < -0.2) return colors.negative;
  return colors.neutral;
}

export function CorrelationPage() {
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
        warning: row.warning ? "High concentration risk" : "Balanced exposure",
      }));
    }

    return [
      { ticker: "MSFT", correlation: 0.74, sector: "Technology", warning: "High concentration risk" },
      { ticker: "XOM", correlation: 0.52, sector: "Energy", warning: "Monitor exposure" },
      { ticker: "PFE", correlation: 0.18, sector: "Healthcare", warning: "Balanced exposure" },
      { ticker: "JPM", correlation: -0.22, sector: "Financials", warning: "Diversifying pair" },
      { ticker: "CAT", correlation: 0.34, sector: "Industrials", warning: "Monitor exposure" },
    ];
  }, [data]);

  const concentrationWarning =
    data?.highRiskPairs.length && data.highRiskPairs.length > 0
      ? `Detected ${data.highRiskPairs.length} highly correlated pair(s). Consider rebalancing to reduce concentration risk.`
      : "Concentration warning: avoid overexposure to one sector by keeping highly correlated positions below 35% of portfolio weight.";

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
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-10" style={{ color: colors.textPrimary }}>
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: colors.brandDark }}>
          Correlation Detector
        </h1>
        <p className="text-sm" style={{ color: colors.textSecondary }}>
          Monitor pair dependencies, detect hidden concentration risk, and keep diversification under control.
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-end"
        style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary }}
      >
        <label className="w-full text-sm sm:max-w-sm">
          <span className="mb-1.5 block font-medium" style={{ color: colors.textSecondary }}>
            Search base company
          </span>
          <input
            value={symbolInput}
            onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
            placeholder="AAPL"
            className="w-full rounded-xl border px-3 py-2 outline-none transition"
            style={{
              borderColor: colors.borderStrong,
              backgroundColor: colors.bgSecondary,
              color: colors.textPrimary,
            }}
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
          style={{ backgroundColor: colors.brandDark }}
        >
          {loading ? "Analyzing..." : "Analyze correlations"}
        </button>
      </form>

      {error ? (
        <div
          className="rounded-xl border px-4 py-3 text-sm"
          style={{ borderColor: `${colors.negative}55`, backgroundColor: `${colors.negative}10`, color: colors.negative }}
        >
          {error}
        </div>
      ) : null}

      <section className="rounded-2xl border p-5 glass-section">
        <h2 className="mb-3 text-base font-semibold" style={{ color: colors.brandDark }}>
          Correlation matrix (placeholder)
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-[560px] border-separate border-spacing-2 text-sm">
            <thead>
              <tr>
                <th className="px-2 py-1 text-left text-xs uppercase" style={{ color: colors.textMuted }}>
                  Ticker
                </th>
                {matrixTickers.map((ticker) => (
                  <th key={`head-${ticker}`} className="px-2 py-1 text-center text-xs uppercase" style={{ color: colors.textMuted }}>
                    {ticker}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATRIX_PLACEHOLDER.map((row, rowIndex) => (
                <tr key={`row-${matrixTickers[rowIndex]}`}>
                  <th className="px-2 py-1 text-left text-xs uppercase" style={{ color: colors.textMuted }}>
                    {matrixTickers[rowIndex]}
                  </th>
                  {row.map((value, colIndex) => (
                    <td
                      key={`${rowIndex}-${colIndex}`}
                      className="rounded-lg border px-3 py-2 text-center font-mono text-xs"
                      style={{
                        borderColor: colors.border,
                        backgroundColor: matrixColor(value),
                        color: correlationTextColor(value),
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

      <section className="rounded-2xl border p-5 glass-section">
        <h2 className="mb-3 text-base font-semibold" style={{ color: colors.brandDark }}>
          Correlated companies
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: colors.border }}>
                <th className="py-2 pr-4 text-xs uppercase" style={{ color: colors.textMuted }}>
                  Ticker
                </th>
                <th className="py-2 pr-4 text-xs uppercase" style={{ color: colors.textMuted }}>
                  Korelacja %
                </th>
                <th className="py-2 pr-4 text-xs uppercase" style={{ color: colors.textMuted }}>
                  Sektor
                </th>
                <th className="py-2 text-xs uppercase" style={{ color: colors.textMuted }}>
                  Ostrzezenie
                </th>
              </tr>
            </thead>
            <tbody>
              {correlatedRows.map((row) => (
                <tr key={row.ticker} className="border-b last:border-b-0" style={{ borderColor: colors.border }}>
                  <td className="py-3 pr-4 font-semibold" style={{ color: colors.brandDark }}>
                    {row.ticker}
                  </td>
                  <td className="py-3 pr-4 font-mono" style={{ color: correlationTextColor(row.correlation) }}>
                    {(row.correlation * 100).toFixed(1)}%
                  </td>
                  <td className="py-3 pr-4" style={{ color: colors.textSecondary }}>
                    {row.sector}
                  </td>
                  <td className="py-3">
                    <span
                      className="rounded-full border px-2 py-1 text-xs font-medium"
                      style={{
                        borderColor: row.warning.includes("High") ? `${colors.negative}66` : `${colors.neutral}66`,
                        color: row.warning.includes("High") ? colors.negative : colors.neutral,
                        backgroundColor: row.warning.includes("High") ? `${colors.negative}12` : `${colors.neutral}12`,
                      }}
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

      <section
        className="rounded-2xl border p-5"
        style={{ borderColor: colors.brandGold, backgroundColor: `${colors.brandGold}12` }}
      >
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide" style={{ color: colors.brandDark }}>
          Ostrzezenie o koncentracji
        </h3>
        <p className="text-sm leading-6" style={{ color: colors.textSecondary }}>
          {concentrationWarning}
        </p>
      </section>

      {data?.insight ? (
        <section className="rounded-2xl border p-5 glass-section">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide" style={{ color: colors.brandDark }}>
            Insight
          </h3>
          <p className="text-sm leading-6" style={{ color: colors.textSecondary }}>
            {data.insight}
          </p>
        </section>
      ) : null}
    </div>
  );
}
