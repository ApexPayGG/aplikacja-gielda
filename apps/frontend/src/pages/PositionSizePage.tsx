import { useState } from "react";
import axios from "axios";
import { api } from "../services/api";
import {
  GLASS_BTN_PRIMARY,
  GLASS_HERO,
  GLASS_INPUT,
  GLASS_LABEL,
  GLASS_PAGE_SUBTITLE,
  GLASS_PAGE_TITLE,
  GLASS_SECTION,
  GLASS_STAT_CARD,
} from "../components/behavioral-coach/glassStyles";
import { apiErrorMessage } from "../utils/apiErrorMessage";

type Conviction = "LOW" | "MEDIUM" | "HIGH";
type Currency = "PLN" | "USD";

type CalcResult = {
  shares: number;
  positionValue: number;
  riskAmount: number;
  actualRiskPct: number;
  maxLoss: number;
  takeProfit1R: number;
  takeProfit2R: number;
  takeProfit3R: number;
};

function formatMoney(n: number, currency: Currency): string {
  return `${n.toFixed(2)} ${currency}`;
}

function parseDecimalInput(value: string): number {
  return Number(String(value).trim().replace(/\s/g, "").replace(/,/g, "."));
}

function convictionFromLevel(level: number): Conviction {
  if (level <= 1) return "LOW";
  if (level >= 3) return "HIGH";
  return "MEDIUM";
}

export function PositionSizePage() {
  const [currency, setCurrency] = useState<Currency>("PLN");
  const [capital, setCapital] = useState("100000");
  const [riskPercent, setRiskPercent] = useState("2");
  const [entryPrice, setEntryPrice] = useState("100");
  const [stopLossPrice, setStopLossPrice] = useState("95");
  const [convictionLevel, setConvictionLevel] = useState(2);
  const [result, setResult] = useState<CalcResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const convictionFillPercent = ((convictionLevel - 1) / 2) * 100;

  const onCalculate = async () => {
    setError(null);
    const acc = parseDecimalInput(capital);
    const risk = parseDecimalInput(riskPercent);
    const entry = parseDecimalInput(entryPrice);
    const stop = parseDecimalInput(stopLossPrice);

    if (
      !Number.isFinite(acc) ||
      acc <= 0 ||
      !Number.isFinite(risk) ||
      risk <= 0 ||
      !Number.isFinite(entry) ||
      entry <= 0 ||
      !Number.isFinite(stop) ||
      stop <= 0
    ) {
      setError("Wpisz poprawne wartosci liczbowe.");
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post<CalcResult>("/position-size/calculate", {
        accountSize: acc,
        riskPercent: risk,
        entryPrice: entry,
        stopLossPrice: stop,
        conviction: convictionFromLevel(convictionLevel),
      });
      setResult(data);
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.data && typeof e.response.data === "object" && "error" in e.response.data) {
        setError(String((e.response.data as { error: string }).error));
      } else {
        setError(apiErrorMessage(e));
      }
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <header className={GLASS_HERO}>
        <h1 className={GLASS_PAGE_TITLE}>Kalkulator pozycji</h1>
        <p className={GLASS_PAGE_SUBTITLE}>
          Wyznacz wielkosc pozycji i maksymalne ryzyko transakcji zgodnie z zasadami zarzadzania kapitalem.
        </p>
      </header>

      <section className={GLASS_SECTION}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-white">Parametry pozycji</h2>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm">
            <span className="text-white/60">Waluta:</span>
            <select
              className="rounded-md border border-white/15 bg-[#0f111c] px-2 py-1 text-sm text-white outline-none"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
            >
              <option value="PLN">PLN</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className={GLASS_LABEL}>Capital</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={capital}
              onChange={(e) => setCapital(e.target.value)}
              className={GLASS_INPUT}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className={GLASS_LABEL}>Risk %</span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={riskPercent}
              onChange={(e) => setRiskPercent(e.target.value)}
              className={GLASS_INPUT}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className={GLASS_LABEL}>Entry</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              className={GLASS_INPUT}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className={GLASS_LABEL}>Stop Loss</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={stopLossPrice}
              onChange={(e) => setStopLossPrice(e.target.value)}
              className={GLASS_INPUT}
            />
          </label>

          <div className="md:col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <span className={GLASS_LABEL}>Conviction</span>
              <span className="text-sm font-semibold text-[#22d3ee]">
                {convictionLevel === 1 ? "LOW" : convictionLevel === 2 ? "MED" : "HIGH"}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={3}
              step={1}
              value={convictionLevel}
              onChange={(e) => setConvictionLevel(Number(e.target.value))}
              className="amc-conviction-slider h-2 w-full cursor-pointer appearance-none rounded-full"
              style={{
                background: `linear-gradient(90deg, #22d3ee ${convictionFillPercent}%, rgba(255,255,255,0.12) ${convictionFillPercent}%)`,
              }}
            />
            <div className="mt-2 flex justify-between text-xs font-semibold text-white/50">
              <span>LOW</span>
              <span>MED</span>
              <span>HIGH</span>
            </div>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300">{error}</div>
        ) : null}

        <button
          type="button"
          disabled={loading}
          onClick={() => void onCalculate()}
          className={`mt-5 ${GLASS_BTN_PRIMARY} disabled:cursor-not-allowed disabled:opacity-70`}
        >
          {loading ? "Liczenie..." : "Oblicz pozycje"}
        </button>
      </section>

      {result ? (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <article className={GLASS_STAT_CARD}>
              <div className="text-xs font-semibold uppercase tracking-wide text-white/50">Liczba akcji</div>
              <div className="mt-2 font-mono text-4xl font-bold text-white">{result.shares}</div>
            </article>
            <article className={GLASS_STAT_CARD}>
              <div className="text-xs font-semibold uppercase tracking-wide text-white/50">Wartosc pozycji</div>
              <div className="mt-2 font-mono text-4xl font-bold text-white">{formatMoney(result.positionValue, currency)}</div>
            </article>
            <article className={GLASS_STAT_CARD}>
              <div className="text-xs font-semibold uppercase tracking-wide text-white/50">Max strata</div>
              <div className="mt-2 font-mono text-4xl font-bold text-white">{formatMoney(result.maxLoss, currency)}</div>
            </article>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-white">Take Profit levels</h3>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { label: "1R", value: result.takeProfit1R },
                { label: "2R", value: result.takeProfit2R },
                { label: "3R", value: result.takeProfit3R },
              ].map((tp) => (
                <article key={tp.label} className={GLASS_STAT_CARD}>
                  <div className="text-xs font-semibold uppercase tracking-wide text-white/50">{tp.label}</div>
                  <div className="mt-2 font-mono text-3xl font-bold text-white">{tp.value.toFixed(4)}</div>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : null}

      <style>{`
        .amc-conviction-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 9999px;
          border: 3px solid #0a0b14;
          background: #9333ea;
          box-shadow: 0 4px 10px rgba(168,85,247, 0.25);
        }
        .amc-conviction-slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 9999px;
          border: 3px solid #0a0b14;
          background: #9333ea;
          box-shadow: 0 4px 10px rgba(168,85,247, 0.25);
        }
      `}</style>
    </div>
  );
}
