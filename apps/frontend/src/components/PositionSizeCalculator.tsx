import { useState } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { api } from "../services/api";
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

export function PositionSizeCalculator() {
  const { t } = useTranslation();
  const [currency, setCurrency] = useState<Currency>("PLN");
  const [accountSize, setAccountSize] = useState("100000");
  const [riskPercent, setRiskPercent] = useState(2);
  const [entryPrice, setEntryPrice] = useState("100");
  const [stopLossPrice, setStopLossPrice] = useState("95");
  const [conviction, setConviction] = useState<Conviction>("MEDIUM");
  const [result, setResult] = useState<CalcResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCalculate = async () => {
    setError(null);
    const acc = Number(accountSize);
    const entry = Number(entryPrice);
    const stop = Number(stopLossPrice);
    if (!Number.isFinite(acc) || acc <= 0 || !Number.isFinite(entry) || entry <= 0 || !Number.isFinite(stop) || stop <= 0) {
      setError(t("positionSize.errorInvalid", { defaultValue: "Enter valid numbers for account, entry, and stop." }));
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post<CalcResult>("/position-size/calculate", {
        accountSize: acc,
        riskPercent,
        entryPrice: entry,
        stopLossPrice: stop,
        conviction,
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
    <div className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white">{t("positionSize.title")}</h1>
      </header>

      <div className="neo-panel rounded-xl p-6">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{t("positionSize.currency")}</span>
            <div className="flex gap-4 text-sm">
              <label className="flex cursor-pointer items-center gap-2">
                <input type="radio" name="cur" checked={currency === "PLN"} onChange={() => setCurrency("PLN")} />
                {t("positionSize.pln")}
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="radio" name="cur" checked={currency === "USD"} onChange={() => setCurrency("USD")} />
                {t("positionSize.usd")}
              </label>
            </div>
          </div>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">{t("positionSize.accountSize")}</span>
            <input
              type="number"
              min="0"
              step="0.01"
              className="rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-white outline-none focus:border-brand-blue"
              value={accountSize}
              onChange={(e) => setAccountSize(e.target.value)}
            />
          </label>

          <div className="md:col-span-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">{t("positionSize.riskPercent")}</span>
              <span className="font-mono text-brand-green">{riskPercent.toFixed(1)}%</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={5}
              step={0.1}
              value={riskPercent}
              onChange={(e) => setRiskPercent(Number(e.target.value))}
              className="mt-2 w-full accent-brand-blue"
            />
          </div>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">{t("positionSize.entry")}</span>
            <input
              type="number"
              min="0"
              step="0.01"
              className="rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-white outline-none focus:border-brand-blue"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">{t("positionSize.stop")}</span>
            <input
              type="number"
              min="0"
              step="0.01"
              className="rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-white outline-none focus:border-brand-blue"
              value={stopLossPrice}
              onChange={(e) => setStopLossPrice(e.target.value)}
            />
          </label>

          <div className="md:col-span-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{t("positionSize.conviction")}</span>
            <div className="mt-2 flex flex-wrap gap-4 text-sm">
              {(["LOW", "MEDIUM", "HIGH"] as const).map((c) => (
                <label key={c} className="flex cursor-pointer items-center gap-2">
                  <input type="radio" name="conv" checked={conviction === c} onChange={() => setConviction(c)} />
                  {c === "LOW" && t("positionSize.convictionLow")}
                  {c === "MEDIUM" && t("positionSize.convictionMedium")}
                  {c === "HIGH" && t("positionSize.convictionHigh")}
                </label>
              ))}
            </div>
          </div>

          <div className="md:col-span-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => void onCalculate()}
              className="interactive-tilt rounded-lg bg-brand-blue px-5 py-2 text-sm font-semibold text-white hover:bg-brand-blue/80 disabled:opacity-60"
            >
              {loading ? t("common.loading") : t("positionSize.calculate")}
            </button>
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-brand-red">{error}</p>}
      </div>

      {result && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="neo-panel rounded-xl p-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">{t("positionSize.shares")}</div>
            <div className="mt-1 font-mono text-2xl font-bold text-white">{result.shares}</div>
          </div>
          <div className="neo-panel rounded-xl p-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">{t("positionSize.positionValue")}</div>
            <div className="mt-1 font-mono text-2xl font-bold text-brand-green">
              {formatMoney(result.positionValue, currency)}
            </div>
          </div>
          <div className="neo-panel rounded-xl p-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">{t("positionSize.plannedRisk")}</div>
            <div className="mt-1 font-mono text-lg text-slate-200">{formatMoney(result.riskAmount, currency)}</div>
          </div>
          <div className="neo-panel rounded-xl p-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">{t("positionSize.actualRiskPct")}</div>
            <div className="mt-1 font-mono text-lg text-brand-blue">{result.actualRiskPct.toFixed(2)}%</div>
          </div>
          <div className="neo-panel rounded-xl p-4 sm:col-span-2">
            <div className="text-xs uppercase tracking-wide text-slate-400">{t("positionSize.maxLoss")}</div>
            <div className="mt-1 font-mono text-2xl font-bold text-brand-red">{formatMoney(result.maxLoss, currency)}</div>
          </div>
          <div className="neo-panel neo-panel-accent rounded-xl p-4 sm:col-span-2">
            <div className="mb-2 text-sm font-semibold text-white">{t("positionSize.takeProfits")}</div>
            <div className="grid gap-2 font-mono text-sm sm:grid-cols-3">
              <div>
                <span className="text-slate-500">{t("positionSize.tp1")}:</span>{" "}
                <span className="text-brand-green">{result.takeProfit1R.toFixed(4)}</span>
              </div>
              <div>
                <span className="text-slate-500">{t("positionSize.tp2")}:</span>{" "}
                <span className="text-brand-green">{result.takeProfit2R.toFixed(4)}</span>
              </div>
              <div>
                <span className="text-slate-500">{t("positionSize.tp3")}:</span>{" "}
                <span className="text-brand-green">{result.takeProfit3R.toFixed(4)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
