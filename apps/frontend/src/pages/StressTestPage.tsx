import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { api } from "../services/api";
import {
  TERMINAL_DANGER_PANEL,
  TERMINAL_TABLE_HEAD,
  TERMINAL_TABLE_ROW,
  TERMINAL_TOOL_CARD,
  TERMINAL_TOOL_EMPTY,
  TERMINAL_TOOL_GRID,
  TERMINAL_TOOL_PAGE,
  TERMINAL_TOOL_PAGE_INNER,
  TERMINAL_TOOL_PANEL,
  TERMINAL_TOOL_TABLE,
} from "../components/terminal/terminalStyles";
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

const SCENARIO_ORDER = ["CRASH_2008", "COVID_2020", "DOT_COM_2001", "CUSTOM"] as const;

function formatMoney(n: number, currency: Currency): string {
  return `${n.toFixed(2)} ${currency}`;
}

export function StressTestPage() {
  const { t } = useTranslation();
  const [currency, setCurrency] = useState<Currency>("PLN");
  const [data, setData] = useState<StressTestResponse | null>(null);
  const [activeScenario, setActiveScenario] = useState<string>("CRASH_2008");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const scenarioMeta = useCallback(
    (code: string) => ({
      icon:
        code === "CRASH_2008"
          ? "BANK"
          : code === "COVID_2020"
            ? "VIRUS"
            : code === "DOT_COM_2001"
              ? "TECH"
              : "CFG",
      name: t(`stressTest.scenarios.${code}`, { defaultValue: code }),
      description: t(`stressTest.scenarioDesc.${code}`, {
        defaultValue: "Historical stress scenario.",
      }),
    }),
    [t],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: body } = await api.get<StressTestResponse>(`/stress-test/${encodeURIComponent(USER_ID)}`);
      setData(body);
      if (body.scenarios.length > 0) {
        setActiveScenario(body.scenarios[0].scenario);
      }
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

  const scenarios = useMemo(() => {
    if (!data?.scenarios.length) return [];
    const byCode = new Map(data.scenarios.map((scenario) => [scenario.scenario, scenario]));
    const ordered = SCENARIO_ORDER.map((code) => byCode.get(code)).filter((scenario): scenario is ScenarioResult => Boolean(scenario));
    if (ordered.length > 0) return ordered;
    return data.scenarios;
  }, [data]);

  const selectedScenario = scenarios.find((scenario) => scenario.scenario === activeScenario) ?? scenarios[0] ?? null;

  const totalLossLabel = selectedScenario
    ? `${selectedScenario.portfolioLossValue > 0 ? "-" : ""}${formatMoney(Math.abs(selectedScenario.portfolioLossValue), currency)}`
    : "-";

  return (
    <div className={TERMINAL_TOOL_PAGE}>
      <div className={TERMINAL_TOOL_PAGE_INNER}>
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terminal-cyan">
              {t("stressTest.eyebrow", { defaultValue: "Portfolio risk lab" })}
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-terminal-text md:text-3xl">
              {t("stressTest.title", { defaultValue: "Portfolio Stress Test" })}
            </h1>
            <p className="mt-2 text-sm text-terminal-textMuted">
              {t("stressTest.subtitle", {
                defaultValue: "Test portfolio resilience in historical scenarios and see potential loss scale.",
              })}
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm text-terminal-textMuted">
            <span>{t("stressTest.currency", { defaultValue: "Display currency" })}:</span>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="radio"
                name="stcur"
                checked={currency === "PLN"}
                onChange={() => setCurrency("PLN")}
                className="accent-terminal-cyan"
              />
              PLN
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="radio"
                name="stcur"
                checked={currency === "USD"}
                onChange={() => setCurrency("USD")}
                className="accent-terminal-cyan"
              />
              USD
            </label>
          </div>
        </header>

        {loading && <p className="text-terminal-textMuted">{t("common.loading", { defaultValue: "Loading..." })}</p>}
        {error ? <div className={TERMINAL_DANGER_PANEL}>{error}</div> : null}

        {!loading && !error && data && data.openPositionCount === 0 && (
          <div className={TERMINAL_TOOL_EMPTY}>
            {t("stressTest.empty", { defaultValue: "Open positions in Paper Trading to see results." })}
          </div>
        )}

        {!loading && !error && data && data.openPositionCount > 0 && (
          <div className="space-y-6">
            <section className={TERMINAL_TOOL_GRID}>
              {scenarios.map((scenario) => {
                const meta = scenarioMeta(scenario.scenario);
                const isActive = selectedScenario?.scenario === scenario.scenario;
                return (
                  <button
                    key={scenario.scenario}
                    type="button"
                    onClick={() => setActiveScenario(scenario.scenario)}
                    className={`${TERMINAL_TOOL_CARD} text-left transition hover:border-terminal-cyan/35 ${
                      isActive ? "border-terminal-cyan/40 shadow-terminal-glow" : ""
                    }`}
                  >
                    <div className="font-mono text-2xl text-terminal-cyan">{meta.icon}</div>
                    <h2 className="mt-2 text-base font-semibold text-terminal-text">{meta.name}</h2>
                    <p className="mt-1 text-sm text-terminal-textMuted">{meta.description}</p>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-terminal-textMuted">
                      {t("stressTest.drop", { defaultValue: "Market drop" })}: {scenario.drop}%
                    </p>
                  </button>
                );
              })}
            </section>

            {selectedScenario ? (
              <>
                <section className={`${TERMINAL_TOOL_PANEL} border-terminal-negative/30`}>
                  <div className="text-xs font-semibold uppercase tracking-wide text-terminal-textMuted">
                    {t("stressTest.portfolioLoss", { defaultValue: "Portfolio loss" })}
                  </div>
                  <div className="mt-2 font-mono text-5xl font-bold text-terminal-negative">{totalLossLabel}</div>
                  <div className="mt-2 text-sm text-terminal-textMuted">
                    {t("stressTest.portfolioLossPct", { defaultValue: "Portfolio loss %" })}:{" "}
                    <span className="font-semibold text-terminal-negative">
                      {selectedScenario.portfolioLossPct.toFixed(2)}%
                    </span>
                  </div>
                </section>

                <section className={TERMINAL_TOOL_TABLE}>
                  <h3 className="mb-4 px-4 pt-4 text-base font-semibold text-terminal-cyan">
                    {t("stressTest.positions", { defaultValue: "Holdings impact" })}
                  </h3>
                  <div className="overflow-x-auto px-4 pb-4">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead>
                        <tr className={TERMINAL_TABLE_HEAD}>
                          <th className="py-2 pr-4">{t("stressTest.colTicker", { defaultValue: "Company" })}</th>
                          <th className="py-2 pr-4">{t("stressTest.currentValue", { defaultValue: "Current value" })}</th>
                          <th className="py-2 pr-4">{t("stressTest.lossValue", { defaultValue: "Loss / gain" })}</th>
                          <th className="py-2">{t("stressTest.newValue", { defaultValue: "Value after shock" })}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedScenario.positionsImpact.map((position) => (
                          <tr key={`${selectedScenario.scenario}-${position.ticker}`} className={TERMINAL_TABLE_ROW}>
                            <td className="py-2 pr-4 font-semibold text-terminal-text">{position.ticker}</td>
                            <td className="py-2 pr-4 font-mono text-terminal-textSecondary">
                              {formatMoney(position.currentValue, currency)}
                            </td>
                            <td
                              className={`py-2 pr-4 font-mono font-semibold ${
                                position.lossValue > 0 ? "text-terminal-negative" : "text-terminal-positive"
                              }`}
                            >
                              {position.lossValue > 0 ? "-" : "+"}
                              {formatMoney(Math.abs(position.lossValue), currency)}
                            </td>
                            <td className="py-2 font-mono text-terminal-textSecondary">
                              {formatMoney(position.newValue, currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
