import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { api } from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";

const USER_ID = "demo-user";

const PIE_COLORS = [
  "rgb(0 242 255)",
  "rgb(2 192 118)",
  "rgb(240 185 11)",
  "rgb(138 43 226)",
  "rgb(207 48 74)",
  "rgb(132 142 156)",
  "rgb(234 236 239)",
];

type StockWeightRow = { ticker: string; sector: string; value: number; weight: number };
type SectorWeightRow = { sector: string; value: number; weight: number };
type ConcentrationWarning = {
  type: "SINGLE_STOCK" | "SINGLE_SECTOR" | "TOP_HEAVY";
  message: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  ticker?: string;
  sector?: string;
  weight?: number;
  top3Share?: number;
};

type ConcentrationResponse = {
  totalValue: number;
  positionCount: number;
  stockWeights: StockWeightRow[];
  sectorWeights: SectorWeightRow[];
  warnings: ConcentrationWarning[];
  diversificationScore: number;
};

type Currency = "PLN" | "USD";

function formatMoney(n: number, currency: Currency): string {
  return `${n.toFixed(2)} ${currency}`;
}

function scoreClass(score: number): string {
  if (score >= 70) return "text-brand-green";
  if (score >= 40) return "text-brand-amber";
  return "text-brand-red";
}

function warningBannerClass(sev: ConcentrationWarning["severity"]): string {
  if (sev === "HIGH") return "border-brand-red/60 bg-brand-red/15 text-red-100";
  if (sev === "MEDIUM") return "border-brand-amber/50 bg-brand-amber/12 text-amber-50";
  return "border-brand-border bg-brand-bg/80 text-slate-200";
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

  const stockPie = useMemo(
    () => (data?.stockWeights ?? []).map((r) => ({ name: r.ticker, value: r.value, weight: r.weight })),
    [data],
  );
  const sectorPie = useMemo(
    () => (data?.sectorWeights ?? []).map((r) => ({ name: r.sector, value: r.value, weight: r.weight })),
    [data],
  );

  const warningText = (w: ConcentrationWarning) =>
    t(`concentration.warnings.${w.type}`, {
      ticker: w.ticker ?? "",
      sector: w.sector ?? "",
      weight: w.weight ?? 0,
      top3Share: w.top3Share ?? 0,
      maxStock: 20,
      maxSector: 40,
      defaultValue: w.message,
    });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-white">{t("concentration.title")}</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-400">{t("concentration.currency")}</span>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="radio" name="ccy" checked={currency === "PLN"} onChange={() => setCurrency("PLN")} />
            PLN
          </label>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="radio" name="ccy" checked={currency === "USD"} onChange={() => setCurrency("USD")} />
            USD
          </label>
        </div>
      </header>

      {loading && <p className="text-slate-400">{t("common.loading")}</p>}
      {error && <p className="text-sm text-brand-red">{error}</p>}

      {!loading && !error && data && data.stockWeights.length === 0 && (
        <div className="neo-panel rounded-xl p-8 text-center text-slate-300">{t("concentration.empty")}</div>
      )}

      {!loading && !error && data && data.stockWeights.length > 0 && (
        <>
          <div className="mb-8 flex flex-wrap items-center gap-8">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{t("concentration.scoreLabel")}</div>
              <div className={`font-mono text-5xl font-bold ${scoreClass(data.diversificationScore)}`}>
                {data.diversificationScore}
              </div>
            </div>
            <div className="text-sm text-slate-400">
              <div>
                {t("concentration.totalValue")}:{" "}
                <span className="font-mono text-white">{formatMoney(data.totalValue, currency)}</span>
              </div>
              <div className="mt-1">
                {t("concentration.positionCount")}: <span className="font-mono text-white">{data.positionCount}</span>
              </div>
            </div>
          </div>

          {data.warnings.length > 0 && (
            <div className="mb-8 space-y-3">
              {data.warnings.map((w, i) => (
                <div
                  key={`${w.type}-${i}-${w.ticker ?? w.sector ?? ""}`}
                  className={`rounded-xl border px-4 py-3 text-sm ${warningBannerClass(w.severity)}`}
                >
                  {warningText(w)}
                </div>
              ))}
            </div>
          )}

          <div className="mb-10 grid gap-6 lg:grid-cols-2">
            <section className="neo-panel rounded-xl p-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-200">{t("concentration.chartByStock")}</h2>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stockPie}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={96}
                      paddingAngle={2}
                    >
                      {stockPie.map((_, idx) => (
                        <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} stroke="rgb(11 14 17)" strokeWidth={1} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, _n, p) => [
                        `${formatMoney(value, currency)} (${(p?.payload as { weight?: number })?.weight?.toFixed(1) ?? "?"}%)`,
                        t("concentration.value"),
                      ]}
                      contentStyle={{ background: "#141920", border: "1px solid rgb(33 40 52)", borderRadius: "8px" }}
                      labelStyle={{ color: "#eaecef" }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="neo-panel rounded-xl p-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-200">{t("concentration.chartBySector")}</h2>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sectorPie}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={96}
                      paddingAngle={2}
                    >
                      {sectorPie.map((_, idx) => (
                        <Cell key={idx} fill={PIE_COLORS[(idx + 2) % PIE_COLORS.length]} stroke="rgb(11 14 17)" strokeWidth={1} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, _n, p) => [
                        `${formatMoney(value, currency)} (${(p?.payload as { weight?: number })?.weight?.toFixed(1) ?? "?"}%)`,
                        t("concentration.value"),
                      ]}
                      contentStyle={{ background: "#141920", border: "1px solid rgb(33 40 52)", borderRadius: "8px" }}
                      labelStyle={{ color: "#eaecef" }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          <section className="neo-panel overflow-x-auto rounded-xl p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-200">{t("concentration.positionsTable")}</h2>
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-brand-border text-xs uppercase text-slate-500">
                  <th className="py-2 pr-4">{t("concentration.colTicker")}</th>
                  <th className="py-2 pr-4">{t("concentration.colSector")}</th>
                  <th className="py-2 pr-4">{t("concentration.colValue")}</th>
                  <th className="py-2">{t("concentration.colWeight")}</th>
                </tr>
              </thead>
              <tbody>
                {data.stockWeights.map((r) => (
                  <tr key={r.ticker} className="border-b border-white/5 font-mono text-slate-200">
                    <td className="py-2 pr-4 font-semibold text-white">{r.ticker}</td>
                    <td className="py-2 pr-4">{r.sector}</td>
                    <td className="py-2 pr-4">{formatMoney(r.value, currency)}</td>
                    <td className="py-2">{r.weight.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
