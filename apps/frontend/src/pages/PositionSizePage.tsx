import { useState } from "react";
import axios from "axios";
import { api } from "../services/api";
import { colors } from "../styles/designSystem";
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
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-10 text-textPrimary">
      <header
        className="rounded-3xl border border-border bg-bgPrimary p-6 shadow-[0_16px_40px_rgba(45,10,107,0.08)]"
        style={{ background: `linear-gradient(120deg, ${colors.bgPrimary}, ${colors.bgSecondary})` }}
      >
        <h1 className="text-3xl font-bold text-brandDark">Kalkulator pozycji</h1>
        <p className="mt-2 text-sm text-textSecondary">
          Wyznacz wielkosc pozycji i maksymalne ryzyko transakcji zgodnie z zasadami zarzadzania kapitalem.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-bgPrimary p-6 shadow-[0_14px_32px_rgba(45,10,107,0.08)]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-brandDark">Parametry pozycji</h2>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-bgSecondary px-3 py-1.5 text-sm">
            <span className="text-textSecondary">Waluta:</span>
            <select
              className="rounded-md border border-border bg-bgPrimary px-2 py-1 text-sm text-textPrimary outline-none"
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
            <span className="font-semibold text-textSecondary">Capital</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={capital}
              onChange={(e) => setCapital(e.target.value)}
              className="rounded-xl border border-border bg-bgSecondary px-3 py-2.5 text-textPrimary outline-none transition focus:border-brandCyan focus:ring-2 focus:ring-brandCyan/20"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-textSecondary">Risk %</span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={riskPercent}
              onChange={(e) => setRiskPercent(e.target.value)}
              className="rounded-xl border border-border bg-bgSecondary px-3 py-2.5 text-textPrimary outline-none transition focus:border-brandCyan focus:ring-2 focus:ring-brandCyan/20"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-textSecondary">Entry</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              className="rounded-xl border border-border bg-bgSecondary px-3 py-2.5 text-textPrimary outline-none transition focus:border-brandCyan focus:ring-2 focus:ring-brandCyan/20"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-textSecondary">Stop Loss</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={stopLossPrice}
              onChange={(e) => setStopLossPrice(e.target.value)}
              className="rounded-xl border border-border bg-bgSecondary px-3 py-2.5 text-textPrimary outline-none transition focus:border-brandCyan focus:ring-2 focus:ring-brandCyan/20"
            />
          </label>

          <div className="md:col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-textSecondary">Conviction</span>
              <span className="text-sm font-semibold text-brandDark">
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
                background: `linear-gradient(90deg, ${colors.brandCyan} ${convictionFillPercent}%, ${colors.bgTertiary} ${convictionFillPercent}%)`,
              }}
            />
            <div className="mt-2 flex justify-between text-xs font-semibold text-textMuted">
              <span>LOW</span>
              <span>MED</span>
              <span>HIGH</span>
            </div>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-negative/20 bg-negative/10 px-4 py-2 text-sm font-medium text-negative">{error}</div>
        ) : null}

        <button
          type="button"
          disabled={loading}
          onClick={() => void onCalculate()}
          className="mt-5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(45,10,107,0.35)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
          style={{ background: `linear-gradient(120deg, ${colors.brandDark}, ${colors.brandMedium})` }}
        >
          {loading ? "Liczenie..." : "Oblicz pozycje"}
        </button>
      </section>

      {result ? (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <article className="rounded-2xl border border-border bg-bgPrimary p-5 shadow-[0_12px_28px_rgba(45,10,107,0.08)]">
              <div className="text-xs font-semibold uppercase tracking-wide text-textMuted">Liczba akcji</div>
              <div className="mt-2 font-mono text-4xl font-bold text-brandDark">{result.shares}</div>
            </article>
            <article className="rounded-2xl border border-border bg-bgPrimary p-5 shadow-[0_12px_28px_rgba(45,10,107,0.08)]">
              <div className="text-xs font-semibold uppercase tracking-wide text-textMuted">Wartosc pozycji</div>
              <div className="mt-2 font-mono text-4xl font-bold text-brandDark">{formatMoney(result.positionValue, currency)}</div>
            </article>
            <article className="rounded-2xl border border-border bg-bgPrimary p-5 shadow-[0_12px_28px_rgba(45,10,107,0.08)]">
              <div className="text-xs font-semibold uppercase tracking-wide text-textMuted">Max strata</div>
              <div className="mt-2 font-mono text-4xl font-bold text-brandDark">{formatMoney(result.maxLoss, currency)}</div>
            </article>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-brandDark">Take Profit levels</h3>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { label: "1R", value: result.takeProfit1R },
                { label: "2R", value: result.takeProfit2R },
                { label: "3R", value: result.takeProfit3R },
              ].map((tp) => (
                <article
                  key={tp.label}
                  className="rounded-2xl border border-border bg-bgPrimary p-5 shadow-[0_12px_28px_rgba(45,10,107,0.08)]"
                >
                  <div className="text-xs font-semibold uppercase tracking-wide text-textMuted">{tp.label}</div>
                  <div className="mt-2 font-mono text-3xl font-bold text-brandDark">{tp.value.toFixed(4)}</div>
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
          border: 3px solid ${colors.bgPrimary};
          background: ${colors.brandDark};
          box-shadow: 0 4px 10px rgba(45, 10, 107, 0.25);
        }
        .amc-conviction-slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 9999px;
          border: 3px solid ${colors.bgPrimary};
          background: ${colors.brandDark};
          box-shadow: 0 4px 10px rgba(45, 10, 107, 0.25);
        }
      `}</style>
    </div>
  );
}
