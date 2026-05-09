import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { api } from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";

type WindowType = "EARNINGS_CYCLE" | "SEASONAL" | "SECTOR_ROTATION" | "REGIME_SHIFT";

type AlphaWindow = {
  ticker: string;
  windowStart: string;
  windowEnd: string;
  type: WindowType;
  probabilityScore: number;
  historicalAvgReturn: number;
  description: string;
  aiNote: string;
};

type AlphaCalendarResponse = {
  generatedAt: string;
  aiSummary: string;
  windows: AlphaWindow[];
};

type AlphaTickerWindowsResponse = {
  ticker: string;
  count: number;
  windows: AlphaWindow[];
};

const mockCalendar: AlphaCalendarResponse = {
  generatedAt: new Date().toISOString(),
  aiSummary:
    "Najmocniejsze okna alpha koncentrują się obecnie na cyklu earnings i sezonowości spółek tech. Ryzyko: szybka zmiana reżimu może skrócić żywotność setupów o wysokiej probabilistyce.",
  windows: [
    {
      ticker: "AAPL",
      windowStart: "2026-05-09T08:00:00.000Z",
      windowEnd: "2026-05-11T23:59:59.000Z",
      type: "EARNINGS_CYCLE",
      probabilityScore: 88,
      historicalAvgReturn: 3.4,
      description: "Okno wokół publikacji wyników kwartalnych (3 dni przed do 1 dnia po).",
      aiNote: "Historycznie po podobnych publikacjach momentum utrzymywało się przez 1-2 sesje.",
    },
    {
      ticker: "MSFT",
      windowStart: "2026-05-09T00:00:00.000Z",
      windowEnd: "2026-06-08T23:59:59.000Z",
      type: "SEASONAL",
      probabilityScore: 79,
      historicalAvgReturn: 2.6,
      description: "Sezonowość miesiąca historycznie wspiera dodatnią stopę zwrotu.",
      aiNote: "Miesięczny profil zwrotu jest dodatni, ale wrażliwy na słabszy NASDAQ.",
    },
    {
      ticker: "NVDA",
      windowStart: "2026-05-09T10:00:00.000Z",
      windowEnd: "2026-05-14T10:00:00.000Z",
      type: "SECTOR_ROTATION",
      probabilityScore: 74,
      historicalAvgReturn: 1.3,
      description: "Reżim RISK_ON faworyzuje sektor Information Technology.",
      aiNote: "Kapitał rotuje do growth, co historycznie wspierało liderów półprzewodników.",
    },
    {
      ticker: "XOM",
      windowStart: "2026-05-09T08:00:00.000Z",
      windowEnd: "2026-05-11T08:00:00.000Z",
      type: "REGIME_SHIFT",
      probabilityScore: 66,
      historicalAvgReturn: -0.4,
      description: "Zmiana reżimu z RISK_ON na RISK_OFF w ostatnich 24h.",
      aiNote: "Po regime shift reakcja bywa gwałtowna — priorytetem jest kontrola ryzyka.",
    },
  ],
};

function isFallbackError(e: unknown): boolean {
  return axios.isAxiosError(e) && (!e.response || e.response.status === 404 || e.response.status >= 500);
}

function typeBadgeClass(type: WindowType): string {
  if (type === "EARNINGS_CYCLE") return "bg-[#0096ff]/20 text-[#8fd3ff]";
  if (type === "SEASONAL") return "bg-[#00c87a]/20 text-[#93f5ca]";
  if (type === "SECTOR_ROTATION") return "bg-purple-500/20 text-purple-200";
  return "bg-orange-500/20 text-orange-200";
}

function typeLabel(type: WindowType, t: (key: string) => string): string {
  if (type === "EARNINGS_CYCLE") return t("alpha.earningsCycle");
  if (type === "SEASONAL") return t("alpha.seasonal");
  if (type === "SECTOR_ROTATION") return t("alpha.sectorRotation");
  return t("alpha.regimeShift");
}

function probabilityColor(score: number): string {
  if (score >= 80) return "text-[#00c87a]";
  if (score >= 60) return "text-[#0096ff]";
  return "text-[#ff4a4a]";
}

function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "n/a";
  return d.toLocaleString();
}

export function AlphaCalendarPage() {
  const { t } = useTranslation();
  const [calendar, setCalendar] = useState<AlphaCalendarResponse | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [tickerInput, setTickerInput] = useState("");
  const [tickerLoading, setTickerLoading] = useState(false);
  const [tickerRows, setTickerRows] = useState<AlphaWindow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [usingMock, setUsingMock] = useState(false);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      setCalendarLoading(true);
      setError(null);
      try {
        const { data } = await api.get<AlphaCalendarResponse>("/alpha/calendar");
        if (!mounted) return;
        setCalendar(data);
      } catch (e) {
        if (!mounted) return;
        if (isFallbackError(e)) {
          setCalendar(mockCalendar);
          setUsingMock(true);
        } else {
          setError(apiErrorMessage(e));
          setCalendar(mockCalendar);
          setUsingMock(true);
        }
      } finally {
        if (mounted) setCalendarLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const sortedWindows = useMemo(
    () => [...(calendar?.windows ?? [])].sort((a, b) => b.probabilityScore - a.probabilityScore),
    [calendar?.windows],
  );

  const onCheckTicker = async (event: React.FormEvent) => {
    event.preventDefault();
    const ticker = tickerInput.trim().toUpperCase();
    if (!ticker) return;
    setTickerLoading(true);
    setError(null);
    try {
      const { data } = await api.get<AlphaTickerWindowsResponse>(`/alpha/windows/${encodeURIComponent(ticker)}`);
      setTickerRows(Array.isArray(data.windows) ? data.windows : []);
    } catch (e) {
      if (isFallbackError(e)) {
        setTickerRows(sortedWindows.filter((w) => w.ticker === ticker));
        setUsingMock(true);
      } else {
        setTickerRows([]);
        setError(apiErrorMessage(e));
      }
    } finally {
      setTickerLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060d18] text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <header className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">📅 {t("alpha.title")} — {t("alpha.windows")}</h1>
            <p className="mt-1 text-sm text-slate-400">
              {new Date().toLocaleDateString()} • Następne 48h
            </p>
          </div>
          <span className={`rounded px-3 py-1 text-xs ${usingMock ? "bg-orange-500/20 text-orange-200" : "bg-slate-700/40 text-slate-300"}`}>
            {usingMock ? "Mock fallback active" : "Live API"}
          </span>
        </header>

        {error && <div className="rounded border border-[#ff4a4a]/30 bg-[#ff4a4a]/10 p-3 text-sm text-[#ff8f8f]">{error}</div>}

        <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          {calendarLoading ? (
            <>
              <div className="h-24 animate-pulse rounded bg-slate-700/30" />
              <div className="grid gap-3 md:grid-cols-3">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={`win-sk-${idx}`} className="h-44 animate-pulse rounded bg-slate-700/35" />
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="rounded-lg border border-[#0096ff]/35 bg-[#0096ff]/12 p-4">
                <h2 className="text-sm font-semibold text-[#9fd8ff]">🤖 AI Summary</h2>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  {calendar?.aiSummary ?? "Brak podsumowania AI."}
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {sortedWindows.map((w, idx) => (
                  <article key={`${w.ticker}-${w.type}-${idx}`} className="rounded-lg border border-slate-800 bg-[#081425] p-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className={`rounded px-2 py-1 text-[11px] font-semibold ${typeBadgeClass(w.type)}`}>{typeLabel(w.type, t)}</span>
                      <span className={`font-mono text-3xl font-bold ${probabilityColor(w.probabilityScore)}`}>{Math.round(w.probabilityScore)}</span>
                    </div>
                    <h3 className="text-lg font-semibold text-white">{w.ticker}</h3>
                    <p className={`mt-1 font-mono text-sm ${w.historicalAvgReturn >= 0 ? "text-[#00c87a]" : "text-[#ff4a4a]"}`}>
                      {t("alpha.historicalReturn")}: {w.historicalAvgReturn >= 0 ? "+" : ""}
                      {w.historicalAvgReturn.toFixed(2)}%
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      {formatDateTime(w.windowStart)} → {formatDateTime(w.windowEnd)}
                    </p>
                    <p className="mt-3 text-sm text-slate-300">{w.description}</p>
                    <p className="mt-3 text-xs italic text-slate-400">{w.aiNote}</p>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="text-lg font-semibold text-white">{t("common.search")}</h2>
          <form onSubmit={onCheckTicker} className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-[220px] flex-col gap-1 text-sm">
              <span className="text-slate-400">Ticker</span>
              <input
                className="rounded border border-slate-700 bg-[#060d18] px-3 py-2 text-white outline-none focus:border-[#0096ff]"
                value={tickerInput}
                onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
                placeholder="AAPL"
              />
            </label>
            <button
              type="submit"
              disabled={tickerLoading}
              className="rounded bg-[#0096ff] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#007cd4] disabled:opacity-60"
            >
              {tickerLoading ? t("common.loading") : t("common.search")}
            </button>
          </form>

          {tickerLoading ? (
            <div className="h-48 animate-pulse rounded bg-slate-700/30" />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-slate-400">
                  <tr className="border-b border-slate-800">
                    <th className="px-2 py-2">{t("alpha.windows")}</th>
                    <th className="px-2 py-2">{t("alpha.probability")}</th>
                    <th className="px-2 py-2">{t("alpha.historicalReturn")}</th>
                    <th className="px-2 py-2">Start</th>
                    <th className="px-2 py-2">End</th>
                    <th className="px-2 py-2">Opis</th>
                  </tr>
                </thead>
                <tbody>
                  {tickerRows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-2 py-6 text-center text-slate-500">
                        Brak okien dla tickera.
                      </td>
                    </tr>
                  )}
                  {tickerRows.map((w, idx) => (
                    <tr key={`${w.ticker}-row-${w.type}-${idx}`} className="border-b border-slate-900/80">
                      <td className="px-2 py-2">
                        <span className={`rounded px-2 py-1 text-[11px] font-semibold ${typeBadgeClass(w.type)}`}>{typeLabel(w.type, t)}</span>
                      </td>
                      <td className={`px-2 py-2 font-mono ${probabilityColor(w.probabilityScore)}`}>{Math.round(w.probabilityScore)}%</td>
                      <td className={`px-2 py-2 font-mono ${w.historicalAvgReturn >= 0 ? "text-[#00c87a]" : "text-[#ff4a4a]"}`}>
                        {w.historicalAvgReturn >= 0 ? "+" : ""}
                        {w.historicalAvgReturn.toFixed(2)}%
                      </td>
                      <td className="px-2 py-2 text-xs text-slate-300">{formatDateTime(w.windowStart)}</td>
                      <td className="px-2 py-2 text-xs text-slate-300">{formatDateTime(w.windowEnd)}</td>
                      <td className="px-2 py-2 text-slate-300">{w.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
