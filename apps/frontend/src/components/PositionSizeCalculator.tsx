import { useEffect, useRef, useState } from "react";
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

/** Parses PL/EU-style decimals (`187,5`) and strips spaces. */
function parseDecimalInput(value: string): number {
  return Number(String(value).trim().replace(/\s/g, "").replace(/,/g, "."));
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
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
  const [copyAnnounced, setCopyAnnounced] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const flashCopied = () => {
    setCopyAnnounced(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopyAnnounced(false), 2200);
  };

  const copyPlain = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      flashCopied();
    } catch {
      /* clipboard may be denied without secure context */
    }
  };

  const onCalculate = async () => {
    setError(null);
    const acc = parseDecimalInput(accountSize);
    const entry = parseDecimalInput(entryPrice);
    const stop = parseDecimalInput(stopLossPrice);
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
      if (axios.isAxiosError(e) && e.response?.status === 404) {
        setError(t("positionSize.errorApi404"));
      } else if (axios.isAxiosError(e) && e.response?.data && typeof e.response.data === "object" && "error" in e.response.data) {
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
              inputMode="decimal"
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
              inputMode="decimal"
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
              inputMode="decimal"
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
          <p className="sr-only" aria-live="polite">
            {copyAnnounced ? t("positionSize.copied") : ""}
          </p>
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
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-white">{t("positionSize.takeProfits")}</div>
              <button
                type="button"
                onClick={() =>
                  void copyPlain(
                    `${t("positionSize.tp1")}\t${result.takeProfit1R.toFixed(4)}\n${t("positionSize.tp2")}\t${result.takeProfit2R.toFixed(4)}\n${t("positionSize.tp3")}\t${result.takeProfit3R.toFixed(4)}`,
                  )
                }
                className="interactive-tilt flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-200 hover:border-brand-blue/50 hover:text-white motion-safe:transition-colors"
                title={t("positionSize.copyAllTp")}
              >
                <CopyIcon />
                {t("positionSize.copyAllTp")}
              </button>
            </div>
            <div className="grid gap-3 font-mono text-sm sm:grid-cols-3">
              {(
                [
                  { key: "tp1", label: t("positionSize.tp1"), value: result.takeProfit1R },
                  { key: "tp2", label: t("positionSize.tp2"), value: result.takeProfit2R },
                  { key: "tp3", label: t("positionSize.tp3"), value: result.takeProfit3R },
                ] as const
              ).map((row) => (
                <div key={row.key} className="flex items-center justify-between gap-2 rounded-lg bg-black/20 px-2 py-1.5">
                  <div className="min-w-0">
                    <span className="text-slate-500">{row.label}:</span>{" "}
                    <span className="text-brand-green">{row.value.toFixed(4)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void copyPlain(row.value.toFixed(4))}
                    className="interactive-tilt shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-brand-blue motion-safe:transition-colors"
                    title={t("positionSize.copy")}
                    aria-label={t("positionSize.copyAriaTp", { label: row.label })}
                  >
                    <CopyIcon />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
