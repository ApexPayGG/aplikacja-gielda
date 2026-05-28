import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../services/api";
import {
  TERMINAL_DANGER_PANEL,
  TERMINAL_TOOL_CARD,
  TERMINAL_TOOL_EMPTY,
  TERMINAL_TOOL_PAGE,
  TERMINAL_TOOL_PAGE_INNER,
  TERMINAL_TOOL_PANEL,
} from "../components/terminal/terminalStyles";
import { apiErrorMessage } from "../utils/apiErrorMessage";

const USER_ID = window.localStorage.getItem("userId")?.trim() || "";

const PIE_COLORS = ["#22d3ee", "#0ea5e9", "#f59e0b", "#0369a1", "#10b981", "#ef4444"];
const PIE_BG = "#1a1f2e";

type StockWeightRow = { ticker: string; sector: string; value: number; weight: number };
type SectorWeightRow = { sector: string; value: number; weight: number };

type ConcentrationResponse = {
  totalValue: number;
  positionCount: number;
  stockWeights: StockWeightRow[];
  sectorWeights: SectorWeightRow[];
  diversificationScore: number;
};

type Currency = "PLN" | "USD";

function formatMoney(n: number, currency: Currency): string {
  return `${n.toFixed(2)} ${currency}`;
}

function scoreClass(score: number): string {
  if (score > 70) return "text-terminal-positive";
  if (score >= 40) return "text-amber-300";
  return "text-terminal-negative";
}

function scoreBorderClass(score: number): string {
  if (score > 70) return "border-terminal-positive/50";
  if (score >= 40) return "border-amber-400/50";
  return "border-terminal-negative/50";
}

export function ConcentrationPage() {
  const { t } = useTranslation();
  const [currency, setCurrency] = useState<Currency>("PLN");
  const [data, setData] = useState<ConcentrationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: body } = await api.get<ConcentrationResponse>(`/concentration/${encodeURIComponent(USER_ID)}`);
      setData(body);
    } catch (e) {
      setData(null);
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pieBackground = useMemo(() => {
    const sectors = data?.sectorWeights ?? [];
    if (sectors.length === 0) {
      return `conic-gradient(${PIE_BG} 0% 100%)`;
    }

    const pieces: string[] = [];
    let cumulative = 0;

    sectors.slice(0, 6).forEach((sector, index) => {
      const start = cumulative;
      cumulative = Math.min(100, cumulative + sector.weight);
      pieces.push(`${PIE_COLORS[index % PIE_COLORS.length]} ${start}% ${cumulative}%`);
    });

    if (cumulative < 100) {
      pieces.push(`${PIE_BG} ${cumulative}% 100%`);
    }

    return `conic-gradient(${pieces.join(", ")})`;
  }, [data?.sectorWeights]);

  const diversificationHint = useMemo(() => {
    if (!data) return "";
    if (data.diversificationScore > 70) {
      return t("concentration.scoreHigh", { defaultValue: "Well-diversified portfolio." });
    }
    if (data.diversificationScore >= 40) {
      return t("concentration.scoreMid", { defaultValue: "Moderate diversification — keep monitoring." });
    }
    return t("concentration.scoreLow", { defaultValue: "High concentration — portfolio risk is elevated." });
  }, [data, t]);

  return (
    <div className={TERMINAL_TOOL_PAGE}>
      <div className={TERMINAL_TOOL_PAGE_INNER}>
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terminal-cyan">
              {t("concentration.eyebrow", { defaultValue: "Allocation risk" })}
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-terminal-text">
              {t("concentration.title", { defaultValue: "Portfolio concentration" })}
            </h1>
            <p className="mt-2 text-sm text-terminal-textMuted">
              {t("concentration.subtitle", {
                defaultValue: "Review capital allocation across companies and sectors to spot excessive concentration risk.",
              })}
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm text-terminal-textMuted">
            <span>{t("concentration.currency", { defaultValue: "Display currency" })}:</span>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input type="radio" name="ccy" checked={currency === "PLN"} onChange={() => setCurrency("PLN")} className="accent-terminal-cyan" />
              PLN
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input type="radio" name="ccy" checked={currency === "USD"} onChange={() => setCurrency("USD")} className="accent-terminal-cyan" />
              USD
            </label>
          </div>
        </header>

        {loading && <p className="text-terminal-textMuted">{t("common.loading", { defaultValue: "Loading..." })}</p>}
        {error && <div className={TERMINAL_DANGER_PANEL}>{error}</div>}

        {!loading && !error && data && data.stockWeights.length === 0 && (
          <div className={TERMINAL_TOOL_EMPTY}>
            {t("concentration.empty", { defaultValue: "Open positions in Paper Trading to see concentration analysis." })}
          </div>
        )}

        {!loading && !error && data && data.stockWeights.length > 0 && (
          <>
            <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <article className={TERMINAL_TOOL_PANEL}>
                <h2 className="mb-4 text-base font-semibold text-terminal-cyan">
                  {t("concentration.chartBySector", { defaultValue: "Allocation by sector" })}
                </h2>
                <div className="flex flex-wrap items-center gap-6">
                  <div
                    className="relative h-56 w-56 rounded-full border-8 border-terminal-panel shadow-terminal-panel"
                    style={{ background: pieBackground }}
                  >
                    <div className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-terminal-border bg-terminal-bg" />
                  </div>
                  <div className="space-y-2 text-sm text-terminal-textMuted">
                    {(data.sectorWeights ?? []).slice(0, 6).map((sector, index) => (
                      <div key={sector.sector} className="flex items-center gap-2">
                        <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                        <span>{sector.sector}</span>
                        <span className="font-semibold text-terminal-text">{sector.weight.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </article>

              <article className={TERMINAL_TOOL_PANEL}>
                <h2 className="mb-4 text-base font-semibold text-terminal-cyan">
                  {t("concentration.scoreLabel", { defaultValue: "Diversification score (0–100)" })}
                </h2>
                <div
                  className={`mx-auto flex h-48 w-48 items-center justify-center rounded-full border-8 font-mono text-5xl font-bold ${scoreClass(data.diversificationScore)} ${scoreBorderClass(data.diversificationScore)}`}
                >
                  {data.diversificationScore}
                </div>
                <p className="mt-4 text-center text-sm text-terminal-textMuted">{diversificationHint}</p>
                <div className="mt-5 text-sm text-terminal-textMuted">
                  <div>
                    {t("concentration.totalValue", { defaultValue: "Total portfolio value" })}:{" "}
                    <span className="font-mono font-semibold text-terminal-text">{formatMoney(data.totalValue, currency)}</span>
                  </div>
                  <div className="mt-1">
                    {t("concentration.positionCount", { defaultValue: "Open paper trades" })}:{" "}
                    <span className="font-mono font-semibold text-terminal-text">{data.positionCount}</span>
                  </div>
                </div>
              </article>
            </section>

            <section className={TERMINAL_TOOL_PANEL}>
              <h2 className="mb-4 text-base font-semibold text-terminal-cyan">
                {t("concentration.positionsTable", { defaultValue: "Positions & weights" })}
              </h2>
              <div className="space-y-4">
                {data.stockWeights.map((row) => (
                  <article key={row.ticker} className={TERMINAL_TOOL_CARD}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-terminal-text">{row.ticker}</div>
                        <div className="text-xs text-terminal-textMuted">{row.sector}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm font-semibold text-terminal-cyan">{row.weight.toFixed(2)}%</div>
                        <div className="text-xs text-terminal-textMuted">{formatMoney(row.value, currency)}</div>
                      </div>
                    </div>
                    <div className="h-2.5 rounded-full bg-terminal-panelSecondary">
                      <div
                        className="h-2.5 rounded-full bg-gradient-to-r from-terminal-cyan to-terminal-cyan/50"
                        style={{ width: `${Math.max(0, Math.min(100, row.weight))}%` }}
                      />
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
