import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { api } from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";

const USER_ID = window.localStorage.getItem("userId")?.trim() || "";

type Currency = "PLN" | "USD";

type PositionImpact = {
  ticker: string;
  currentValue: number;
  lossValue: number;
  newValue: number;
};

type ScenarioResult = {
  scenario: string;
  drop: number;
  portfolioLossPct: number;
  portfolioLossValue: number;
  positionsImpact: PositionImpact[];
};

type StressTestResponse = {
  openPositionCount: number;
  scenarios: ScenarioResult[];
};

function formatMoney(n: number, currency: Currency): string {
  return `${n.toFixed(2)} ${currency}`;
}

function scenarioCardStyle(lossValue: number, maxPositiveLoss: number): CSSProperties {
  if (maxPositiveLoss <= 0 || lossValue <= 0) {
    return {};
  }
  const t = Math.min(1, lossValue / maxPositiveLoss);
  const a = 0.08 + t * 0.22;
  return {
    borderColor: `rgb(207 48 74 / ${0.35 + t * 0.45})`,
    background: `linear-gradient(165deg, rgb(207 48 74 / ${a}) 0%, rgb(18 22 28 / 0.96) 55%, rgb(12 15 20 / 0.98) 100%)`,
  };
}

export function StressTestPage() {
  const { t } = useTranslation();
  const [currency, setCurrency] = useState<Currency>("PLN");
  const [data, setData] = useState<StressTestResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: body } = await api.get<StressTestResponse>(`/stress-test/${encodeURIComponent(USER_ID)}`);
      setData(body);
    } catch (e) {
      setData(null);
      if (axios.isAxiosError(e) && e.response?.status === 404) {
        setError(t("stressTest.error404", { defaultValue: "Stress test API not found." }));
      } else {
        setError(apiErrorMessage(e));
      }
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const maxPositiveLoss = useMemo(() => {
    if (!data?.scenarios.length) return 0;
    return Math.max(0, ...data.scenarios.map((s) => Math.max(0, s.portfolioLossValue)));
  }, [data]);

  const scenarioTitle = (s: ScenarioResult) => {
    if (s.scenario === "CUSTOM") {
      return t("stressTest.scenarios.CUSTOM", { drop: Math.abs(s.drop) });
    }
    return t(`stressTest.scenarios.${s.scenario}`, { defaultValue: s.scenario });
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-white">{t("stressTest.title")}</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-400">{t("stressTest.currency")}</span>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="radio" name="stcur" checked={currency === "PLN"} onChange={() => setCurrency("PLN")} />
            PLN
          </label>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="radio" name="stcur" checked={currency === "USD"} onChange={() => setCurrency("USD")} />
            USD
          </label>
        </div>
      </header>

      {loading && <p className="text-slate-400">{t("common.loading")}</p>}
      {error && <p className="text-sm text-brand-red">{error}</p>}

      {!loading && !error && data && data.openPositionCount === 0 && (
        <div className="neo-panel rounded-xl p-8 text-center text-slate-300">{t("stressTest.empty")}</div>
      )}

      {!loading && !error && data && data.openPositionCount > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.scenarios.map((s) => (
            <section
              key={s.scenario}
              className="neo-panel rounded-xl border p-5 motion-safe:transition-colors"
              style={scenarioCardStyle(s.portfolioLossValue, maxPositiveLoss)}
            >
              <h2 className="text-lg font-semibold text-white">{scenarioTitle(s)}</h2>
              <p className="mt-1 text-sm text-slate-400">
                {t("stressTest.drop")}: <span className="font-mono text-slate-200">{s.drop}%</span>
              </p>
              <div className="mt-4 space-y-1 font-mono text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-400">{t("stressTest.portfolioLoss")}</span>
                  <span className={s.portfolioLossValue > 0 ? "text-brand-red" : "text-brand-green"}>
                    {formatMoney(s.portfolioLossValue, currency)}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-400">{t("stressTest.portfolioLossPct")}</span>
                  <span className={s.portfolioLossPct > 0 ? "text-brand-red" : "text-brand-green"}>
                    {s.portfolioLossPct.toFixed(2)}%
                  </span>
                </div>
              </div>
              <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("stressTest.positions")}</h3>
              <ul className="mt-2 space-y-2 text-sm">
                {s.positionsImpact.map((p) => (
                  <li key={`${s.scenario}-${p.ticker}`} className="rounded-lg border border-white/5 bg-black/20 px-3 py-2">
                    <div className="font-semibold text-white">{p.ticker}</div>
                    <div className="mt-1 flex flex-col gap-1 font-mono text-xs text-slate-300 sm:grid sm:grid-cols-3 sm:gap-2">
                      <span>
                        {t("stressTest.currentValue")}: {formatMoney(p.currentValue, currency)}
                      </span>
                      <span className={p.lossValue > 0 ? "text-brand-red" : p.lossValue < 0 ? "text-brand-green" : ""}>
                        {t("stressTest.lossValue")}: {formatMoney(p.lossValue, currency)}
                      </span>
                      <span>{t("stressTest.newValue")}: {formatMoney(p.newValue, currency)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
