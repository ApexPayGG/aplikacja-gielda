import { useCallback, useEffect, useState } from "react";
import { AlertsTimeline } from "../components/AlertsTimeline";
import { DividendScoreCard } from "../components/DividendScoreCard";
import { SectorHeatmap } from "../components/SectorHeatmap";
import { TrendIndicator, type TrendDirection } from "../components/TrendIndicator";
import { getCompanyDetail, getDividendAlerts, getDividendIntelligence, getSectorComparison } from "../services/api";
import type { DividendAlert, DividendIntelligence, SectorComparison } from "../types/dividend";
import { apiErrorMessage } from "../utils/apiErrorMessage";

const DEBOUNCE_MS = 450;

function normalizeTrend(d: string): TrendDirection {
  if (d === "up" || d === "down" || d === "stable") return d;
  return "stable";
}

export function DividendIntelligencePage() {
  const [input, setInput] = useState("AAPL");
  const [symbol, setSymbol] = useState("AAPL");
  const [intelligence, setIntelligence] = useState<DividendIntelligence | null>(null);
  const [alerts, setAlerts] = useState<DividendAlert[]>([]);
  const [sectors, setSectors] = useState<SectorComparison>({});
  const [symbolSector, setSymbolSector] = useState("");

  const [loadingIntel, setLoadingIntel] = useState(false);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [loadingSectors, setLoadingSectors] = useState(false);
  const [errorIntel, setErrorIntel] = useState<string | null>(null);
  const [errorAlerts, setErrorAlerts] = useState<string | null>(null);
  const [errorSectors, setErrorSectors] = useState<string | null>(null);

  const loadSectors = useCallback(async () => {
    setLoadingSectors(true);
    setErrorSectors(null);
    try {
      const { data } = await getSectorComparison();
      setSectors(data);
    } catch (e) {
      setErrorSectors(apiErrorMessage(e));
      setSectors({});
    } finally {
      setLoadingSectors(false);
    }
  }, []);

  const loadForSymbol = useCallback(async (sym: string) => {
    const s = sym.trim().toUpperCase();
    if (!s) return;

    setLoadingIntel(true);
    setLoadingAlerts(true);
    setErrorIntel(null);
    setErrorAlerts(null);

    try {
      const [intelRes, alertsRes, company] = await Promise.all([
        getDividendIntelligence(s),
        getDividendAlerts(s, 20),
        getCompanyDetail(s).catch(() => null),
      ]);
      setIntelligence(intelRes.data);
      setAlerts(alertsRes.data.alerts);
      setSymbolSector(company?.sector ?? "");
    } catch (e) {
      const msg = apiErrorMessage(e);
      setIntelligence(null);
      setAlerts([]);
      setSymbolSector("");
      setErrorIntel(msg);
      setErrorAlerts(msg);
    } finally {
      setLoadingIntel(false);
      setLoadingAlerts(false);
    }
  }, []);

  useEffect(() => {
    void loadSectors();
  }, [loadSectors]);

  useEffect(() => {
    const t = window.setTimeout(() => setSymbol(input.trim().toUpperCase() || "AAPL"), DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [input]);

  useEffect(() => {
    void loadForSymbol(symbol);
  }, [symbol, loadForSymbol]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white">Dividend Intelligence</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Safety score, trend, sektor i ostatnie alerty (Phase 10.5). Wpisz ticker — dane odświeżają się z opóźnieniem (
          {DEBOUNCE_MS} ms).
        </p>
        <label className="mt-6 block max-w-xs text-sm">
          <span className="text-slate-400">Symbol</span>
          <input
            className="mt-1 block w-full rounded-md border border-surface-border bg-surface px-3 py-2 font-mono uppercase text-white"
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            placeholder="AAPL"
            autoComplete="off"
          />
        </label>
      </header>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          {loadingIntel && <p className="text-sm text-slate-500">Ładowanie intelligence…</p>}
          {errorIntel && <p className="text-sm text-red-400">{errorIntel}</p>}
          {intelligence && !loadingIntel && (
            <>
              <DividendScoreCard safetyScore={intelligence.safetyScore} safetyReason={intelligence.safetyReason} />
              <TrendIndicator direction={normalizeTrend(intelligence.trendDirection)} />
              <p className="text-xs text-slate-500">
                Sector percentile: <span className="font-mono text-slate-300">{intelligence.sectorPercentile}</span>{" "}
                (vs peers in sector)
              </p>
            </>
          )}
        </div>

        <div>
          {loadingSectors && <p className="text-sm text-slate-500">Ładowanie heatmapy sektorów…</p>}
          {errorSectors && <p className="text-sm text-red-400">{errorSectors}</p>}
          <SectorHeatmap sectorData={sectors} selectedSymbolSector={symbolSector} />
        </div>
      </div>

      <div className="mt-10">
        {loadingAlerts && <p className="text-sm text-slate-500">Ładowanie alertów…</p>}
        {errorAlerts && !errorIntel && <p className="text-sm text-red-400">{errorAlerts}</p>}
        <AlertsTimeline alerts={alerts} symbol={symbol} />
      </div>
    </div>
  );
}
