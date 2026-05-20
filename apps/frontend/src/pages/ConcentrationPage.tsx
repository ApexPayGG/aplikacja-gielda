import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import { colors } from "../styles/designSystem";
import { apiErrorMessage } from "../utils/apiErrorMessage";

const USER_ID = window.localStorage.getItem("userId")?.trim() || "";

const PIE_COLORS = [colors.brandCyan, colors.brandMedium, colors.brandGold, colors.brandDark, colors.positive, colors.negative];

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
  if (score > 70) return "text-positive";
  if (score >= 40) return "text-brandGold";
  return "text-negative";
}

export function ConcentrationPage() {
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
      return `conic-gradient(${colors.bgTertiary} 0% 100%)`;
    }

    const pieces: string[] = [];
    let cumulative = 0;

    sectors.slice(0, 6).forEach((sector, index) => {
      const start = cumulative;
      cumulative = Math.min(100, cumulative + sector.weight);
      pieces.push(`${PIE_COLORS[index % PIE_COLORS.length]} ${start}% ${cumulative}%`);
    });

    if (cumulative < 100) {
      pieces.push(`${colors.bgTertiary} ${cumulative}% 100%`);
    }

    return `conic-gradient(${pieces.join(", ")})`;
  }, [data?.sectorWeights]);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-10 text-white">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Koncentracja portfela</h1>
          <p className="mt-2 glass-muted text-sm">
            Ocen rozklad kapitalu miedzy spolki i sektory, aby szybko wykryc ryzyko nadmiernej koncentracji.
          </p>
        </div>
        <div className="flex items-center gap-3 glass-muted text-sm">
          <span>Waluta:</span>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="radio" name="ccy" checked={currency === "PLN"} onChange={() => setCurrency("PLN")} className="accent-brandCyan" />
            PLN
          </label>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="radio" name="ccy" checked={currency === "USD"} onChange={() => setCurrency("USD")} className="accent-brandCyan" />
            USD
          </label>
        </div>
      </header>

      {loading && <p className="glass-muted">Ladowanie...</p>}
      {error && (
        <div className="rounded-xl border border-negative/25 bg-negative/10 px-4 py-3 text-sm font-medium text-negative">{error}</div>
      )}

      {!loading && !error && data && data.stockWeights.length === 0 && (
        <div className="glass-section rounded-2xl p-8 text-center glass-muted">Brak danych o pozycjach w portfelu.</div>
      )}

      {!loading && !error && data && data.stockWeights.length > 0 && (
        <>
          <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <article className="glass-section rounded-2xl p-6 shadow-[0_14px_32px_rgba(45,10,107,0.08)]">
              <h2 className="mb-4 text-base font-semibold text-white">Rozklad sektorowy (placeholder)</h2>
              <div className="flex flex-wrap items-center gap-6">
                <div
                  className="relative h-56 w-56 rounded-full border-8"
                  style={{
                    background: pieBackground,
                    borderColor: colors.bgPrimary,
                    boxShadow: "0 14px 34px rgba(45, 10, 107, 0.12)",
                  }}
                >
                  <div
                    className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border"
                    style={{ backgroundColor: colors.bgPrimary, borderColor: colors.border }}
                  />
                </div>
                <div className="space-y-2 glass-muted text-sm">
                  {(data.sectorWeights ?? []).slice(0, 6).map((sector, index) => (
                    <div key={sector.sector} className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                      <span>{sector.sector}</span>
                      <span className="font-semibold text-white">{sector.weight.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </article>

            <article className="glass-section rounded-2xl p-6 shadow-[0_14px_32px_rgba(45,10,107,0.08)]">
              <h2 className="mb-4 text-base font-semibold text-white">Diversification score</h2>
              <div
                className={`mx-auto flex h-48 w-48 items-center justify-center rounded-full border-8 font-mono text-5xl font-bold ${scoreClass(data.diversificationScore)}`}
                style={{ borderColor: data.diversificationScore > 70 ? colors.positive : data.diversificationScore >= 40 ? colors.brandGold : colors.negative }}
              >
                {data.diversificationScore}
              </div>
              <p className="mt-4 text-center glass-muted text-sm">
                {data.diversificationScore > 70
                  ? "Dobrze zdywersyfikowany portfel."
                  : data.diversificationScore >= 40
                    ? "Umiarkowana dywersyfikacja - warto monitorowac."
                    : "Wysoka koncentracja - ryzyko portfela rosnie."}
              </p>
              <div className="mt-5 glass-muted text-sm">
                <div>
                  Wartosc portfela: <span className="font-mono font-semibold text-white">{formatMoney(data.totalValue, currency)}</span>
                </div>
                <div className="mt-1">
                  Liczba pozycji: <span className="font-mono font-semibold text-white">{data.positionCount}</span>
                </div>
              </div>
            </article>
          </section>

          <section className="glass-section rounded-2xl p-6 shadow-[0_14px_32px_rgba(45,10,107,0.08)]">
            <h2 className="mb-4 text-base font-semibold text-white">Udzial spolek w portfelu</h2>
            <div className="space-y-4">
              {data.stockWeights.map((row) => (
                <article key={row.ticker} className="glass-panel rounded-xl p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">{row.ticker}</div>
                      <div className="text-xs text-white/50">{row.sector}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm font-semibold text-white">{row.weight.toFixed(2)}%</div>
                      <div className="text-xs text-white/50">{formatMoney(row.value, currency)}</div>
                    </div>
                  </div>
                  <div className="h-2.5 rounded-full" style={{ backgroundColor: colors.bgTertiary }}>
                    <div
                      className="h-2.5 rounded-full"
                      style={{
                        width: `${Math.max(0, Math.min(100, row.weight))}%`,
                        background: `linear-gradient(90deg, ${colors.brandCyan}, ${colors.brandDark})`,
                      }}
                    />
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
