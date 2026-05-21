import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { api } from "../services/api";
import { colors } from "../styles/designSystem";
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

const SCENARIO_META: Record<string, { icon: string; name: string; description: string }> = {
  CRASH_2008: {
    icon: "BANK",
    name: "2008 Crash",
    description: "Globalny kryzys kredytowy i mocna wyprzedaz rynku akcji.",
  },
  COVID_2020: {
    icon: "VIRUS",
    name: "COVID 2020",
    description: "Nagly szok podazowo-popytowy i gwaltowne tniecie wycen.",
  },
  DOT_COM_2001: {
    icon: "TECH",
    name: "Dot-com 2001",
    description: "Pekniecie banki technologicznej i kaskada spadkow growth.",
  },
  CUSTOM: {
    icon: "CFG",
    name: "Custom",
    description: "Wlasny scenariusz drawdownu ustawiany przez parametr API.",
  },
};

const SCENARIO_ORDER = ["CRASH_2008", "COVID_2020", "DOT_COM_2001", "CUSTOM"] as const;

function formatMoney(n: number, currency: Currency): string {
  return `${n.toFixed(2)} ${currency}`;
}

export function StressTestPage() {
  const [currency, setCurrency] = useState<Currency>("PLN");
  const [data, setData] = useState<StressTestResponse | null>(null);
  const [activeScenario, setActiveScenario] = useState<string>("CRASH_2008");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        setError("Stress test API not found.");
      } else {
        setError(apiErrorMessage(e));
      }
    } finally {
      setLoading(false);
    }
  }, []);

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
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-10 text-white">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Stress Test Portfela</h1>
          <p className="mt-2 glass-muted text-sm">
            Sprawdz odpornosc portfela w scenariuszach historycznych i zobacz potencjalna skale strat.
          </p>
        </div>
        <div className="flex items-center gap-3 glass-muted text-sm">
          <span>Waluta:</span>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="radio"
              name="stcur"
              checked={currency === "PLN"}
              onChange={() => setCurrency("PLN")}
              className="accent-brandCyan"
            />
            PLN
          </label>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="radio"
              name="stcur"
              checked={currency === "USD"}
              onChange={() => setCurrency("USD")}
              className="accent-brandCyan"
            />
            USD
          </label>
        </div>
      </header>

      {loading && <p className="glass-muted">Ladowanie...</p>}
      {error && (
        <div className="rounded-xl border border-negative/25 bg-negative/10 px-4 py-3 text-sm font-medium text-negative">{error}</div>
      )}

      {!loading && !error && data && data.openPositionCount === 0 && (
        <div className="glass-section rounded-2xl p-8 text-center glass-muted">Brak otwartych pozycji do analizy.</div>
      )}

      {!loading && !error && data && data.openPositionCount > 0 && (
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {scenarios.map((scenario) => {
              const meta = SCENARIO_META[scenario.scenario] ?? {
                icon: "RISK",
                name: scenario.scenario,
                description: "Scenariusz testu warunkow skrajnych.",
              };
              const isActive = selectedScenario?.scenario === scenario.scenario;
              return (
                <button
                  key={scenario.scenario}
                  type="button"
                  onClick={() => setActiveScenario(scenario.scenario)}
                  className="rounded-2xl border bg-bgPrimary p-4 text-left shadow-[0_12px_26px_rgba(168,85,247,0.08)] transition hover:translate-y-[-1px]"
                  style={{ borderColor: isActive ? colors.brandCyan : colors.border }}
                >
                  <div className="text-2xl">{meta.icon}</div>
                  <h2 className="mt-2 text-base font-semibold text-white">{meta.name}</h2>
                  <p className="mt-1 glass-muted text-sm">{meta.description}</p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-white/50">Drop: {scenario.drop}%</p>
                </button>
              );
            })}
          </section>

          {selectedScenario ? (
            <>
              <section className="rounded-2xl border border-negative/25 bg-bgPrimary p-6 shadow-[0_14px_32px_rgba(168,85,247,0.08)]">
                <div className="text-xs font-semibold uppercase tracking-wide text-white/50">Laczna strata portfela</div>
                <div className="mt-2 font-mono text-5xl font-bold text-negative">{totalLossLabel}</div>
                <div className="mt-2 glass-muted text-sm">
                  Szacowana zmiana:{" "}
                  <span style={{ color: colors.negative }} className="font-semibold">
                    {selectedScenario.portfolioLossPct.toFixed(2)}%
                  </span>
                </div>
              </section>

              <section className="overflow-x-auto glass-section rounded-2xl p-5 shadow-[0_14px_32px_rgba(168,85,247,0.08)]">
                <h3 className="mb-4 text-base font-semibold text-white">Szacowane straty na pozycjach</h3>
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-white/50">
                      <th className="py-2 pr-4">Spolka</th>
                      <th className="py-2 pr-4">Biezaca wartosc</th>
                      <th className="py-2 pr-4">Szacowana strata</th>
                      <th className="py-2">Nowa wartosc</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedScenario.positionsImpact.map((position) => (
                      <tr key={`${selectedScenario.scenario}-${position.ticker}`} className="border-b border-white/10/70">
                        <td className="py-2 pr-4 font-semibold text-white">{position.ticker}</td>
                        <td className="py-2 pr-4 font-mono text-white">{formatMoney(position.currentValue, currency)}</td>
                        <td className="py-2 pr-4 font-mono font-semibold" style={{ color: position.lossValue > 0 ? colors.negative : colors.positive }}>
                          {position.lossValue > 0 ? "-" : "+"}
                          {formatMoney(Math.abs(position.lossValue), currency)}
                        </td>
                        <td className="py-2 font-mono text-white">{formatMoney(position.newValue, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
