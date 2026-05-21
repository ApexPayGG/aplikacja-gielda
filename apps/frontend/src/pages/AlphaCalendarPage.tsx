import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { api } from "../services/api";
import { colors } from "../styles/designSystem";
import { apiErrorMessage } from "../utils/apiErrorMessage";

type WindowType = "EARNINGS_CYCLE" | "SEASONAL" | "SECTOR_ROTATION" | "REGIME_SHIFT";
type CalendarMode = "MONTH" | "WEEK";
type ProbabilityWindowType = "BULLISH" | "BEARISH" | "VOLATILE" | "NEUTRAL";

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

const probabilityWindowTypeMeta: Record<ProbabilityWindowType, { label: string; color: string }> = {
  BULLISH: { label: "BULLISH", color: colors.positive },
  BEARISH: { label: "BEARISH", color: colors.negative },
  VOLATILE: { label: "VOLATILE", color: colors.brandGold },
  NEUTRAL: { label: "NEUTRAL", color: colors.textMuted },
};

const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

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

function isFallbackError(error: unknown): boolean {
  return axios.isAxiosError(error) && (!error.response || error.response.status === 404 || error.response.status >= 500);
}

function mapWindowType(type: WindowType): ProbabilityWindowType {
  if (type === "EARNINGS_CYCLE") return "BULLISH";
  if (type === "REGIME_SHIFT") return "BEARISH";
  if (type === "SECTOR_ROTATION") return "VOLATILE";
  return "NEUTRAL";
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date: Date): Date {
  const weekday = date.getDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  return startOfDay(addDays(date, offset));
}

function toDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDayKey(key: string): Date | null {
  const [y, m, d] = key.split("-").map((part) => Number(part));
  if (!y || !m || !d) return null;
  const parsed = new Date(y, m - 1, d);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildMonthGrid(referenceDate: Date): Date[] {
  const firstDayOfMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const gridStart = startOfWeek(firstDayOfMonth);
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

function buildWeekGrid(referenceDate: Date): Date[] {
  const weekStart = startOfWeek(referenceDate);
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

function isWeekend(date: Date): boolean {
  const weekday = date.getDay();
  return weekday === 0 || weekday === 6;
}

function normalizeProbability(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function formatDateTime(value: string, fallback: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString();
}

export function AlphaCalendarPage() {
  const { t } = useTranslation();
  const [calendar, setCalendar] = useState<AlphaCalendarResponse | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingMock, setUsingMock] = useState(false);
  const [mode, setMode] = useState<CalendarMode>("MONTH");
  const [selectedDayKey, setSelectedDayKey] = useState(() => toDayKey(new Date()));

  useEffect(() => {
    let mounted = true;
    void (async () => {
      setCalendarLoading(true);
      setError(null);
      try {
        const { data } = await api.get<AlphaCalendarResponse>("/alpha/calendar");
        if (!mounted) return;
        setCalendar(data);
        setUsingMock(false);
      } catch (fetchError) {
        if (!mounted) return;
        if (!isFallbackError(fetchError)) {
          setError(apiErrorMessage(fetchError));
        }
        setCalendar(mockCalendar);
        setUsingMock(true);
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

  const windowsByDay = useMemo(() => {
    const byDay: Record<string, AlphaWindow[]> = {};
    for (const windowItem of sortedWindows) {
      const startDate = startOfDay(new Date(windowItem.windowStart));
      const endDate = startOfDay(new Date(windowItem.windowEnd));
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) continue;
      let cursor = startDate;
      let guard = 0;
      while (cursor <= endDate && guard < 370) {
        const key = toDayKey(cursor);
        if (!byDay[key]) byDay[key] = [];
        byDay[key].push(windowItem);
        cursor = addDays(cursor, 1);
        guard += 1;
      }
    }
    return byDay;
  }, [sortedWindows]);

  useEffect(() => {
    if (sortedWindows.length === 0) return;
    if ((windowsByDay[selectedDayKey] ?? []).length > 0) return;
    const firstWindowDate = startOfDay(new Date(sortedWindows[0].windowStart));
    if (Number.isNaN(firstWindowDate.getTime())) return;
    setSelectedDayKey(toDayKey(firstWindowDate));
  }, [selectedDayKey, sortedWindows, windowsByDay]);

  const selectedDate = useMemo(() => parseDayKey(selectedDayKey) ?? startOfDay(new Date()), [selectedDayKey]);
  const visibleDays = useMemo(
    () => (mode === "MONTH" ? buildMonthGrid(selectedDate) : buildWeekGrid(selectedDate)),
    [mode, selectedDate],
  );
  const selectedDayWindows = windowsByDay[selectedDayKey] ?? [];
  const monthLabel = selectedDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const selectedDateLabel = selectedDate.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const naDate = t("common.notAvailable");

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold" style={{ color: colors.brandDark }}>
              Alpha Calendar
            </h1>
            <p className="text-sm" style={{ color: colors.textSecondary }}>
              Probabilistic window map for the current market cycle.
            </p>
            <div className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: colors.bgSecondary, color: colors.textSecondary }}>
              {usingMock ? t("common.apiMockBadge") : t("common.apiLiveBadge")}
            </div>
          </div>
          <div className="inline-flex items-center rounded-2xl border p-1.5 glass-panel">
            {(["MONTH", "WEEK"] as const).map((view) => {
              const active = mode === view;
              return (
                <button
                  key={view}
                  type="button"
                  onClick={() => setMode(view)}
                  className="rounded-xl px-4 py-2 text-sm font-semibold transition"
                  style={{
                    backgroundColor: active ? colors.brandDark : "transparent",
                    color: active ? colors.bgPrimary : colors.textSecondary,
                  }}
                >
                  {view === "MONTH" ? "Month" : "Week"}
                </button>
              );
            })}
          </div>
        </header>

        {error ? (
          <div
            className="rounded-2xl border px-4 py-3 text-sm"
            style={{
              borderColor: colors.negative,
              color: colors.negative,
              backgroundColor: `${colors.negative}14`,
            }}
          >
            {error}
          </div>
        ) : null}

        {calendarLoading ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(280px,1fr)]">
            <div className="space-y-4 rounded-2xl border p-5 glass-panel">
              <div className="h-7 w-1/3 animate-pulse rounded" style={{ backgroundColor: colors.bgTertiary }} />
              <div className="grid grid-cols-7 gap-3">
                {Array.from({ length: 14 }).map((_, idx) => (
                  <div key={`day-skeleton-${idx}`} className="h-24 animate-pulse rounded-xl" style={{ backgroundColor: colors.bgTertiary }} />
                ))}
              </div>
            </div>
            <div className="rounded-2xl border p-5 glass-panel">
              <div className="mb-4 h-6 w-1/2 animate-pulse rounded" style={{ backgroundColor: colors.bgTertiary }} />
              <div className="h-44 animate-pulse rounded-xl" style={{ backgroundColor: colors.bgTertiary }} />
            </div>
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(300px,1fr)]">
            <section className="space-y-4 rounded-2xl border p-5 glass-panel">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold capitalize" style={{ color: colors.brandDark }}>
                  {monthLabel}
                </h2>
                <span className="text-xs" style={{ color: colors.textMuted }}>
                  {mode === "MONTH" ? "Monthly overview" : "Week snapshot"}
                </span>
              </div>

              <div className="grid grid-cols-7 gap-2">
                {weekdayLabels.map((day) => (
                  <div key={day} className="text-center text-xs font-semibold uppercase tracking-wide" style={{ color: colors.textMuted }}>
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {visibleDays.map((day) => {
                  const dayKey = toDayKey(day);
                  const isActive = dayKey === selectedDayKey;
                  const outsideReferenceMonth = day.getMonth() !== selectedDate.getMonth();
                  const entries = windowsByDay[dayKey] ?? [];
                  const dayTypes = Array.from(new Set(entries.map((entry) => mapWindowType(entry.type))));
                  const mutedText = outsideReferenceMonth && mode === "MONTH";
                  return (
                    <button
                      key={dayKey}
                      type="button"
                      onClick={() => setSelectedDayKey(dayKey)}
                      className="min-h-[120px] rounded-xl border p-3 text-left transition"
                      style={{
                        borderColor: isActive ? colors.brandCyan : colors.border,
                        backgroundColor: isWeekend(day) ? colors.bgSecondary : colors.bgPrimary,
                        boxShadow: isActive ? "0 0 0 1px rgba(34,211,238, 0.3)" : "none",
                        opacity: mutedText ? 0.75 : 1,
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold" style={{ color: mutedText ? colors.textMuted : colors.textPrimary }}>
                          {day.getDate()}
                        </span>
                        {entries.length > 0 ? (
                          <span className="text-[11px] font-semibold" style={{ color: colors.brandDark }}>
                            {entries.length}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-3 space-y-1.5">
                        {dayTypes.length === 0 ? (
                          <p className="text-[11px]" style={{ color: colors.textMuted }}>
                            No windows
                          </p>
                        ) : (
                          dayTypes.slice(0, 3).map((dayType) => {
                            const meta = probabilityWindowTypeMeta[dayType];
                            return (
                              <div key={`${dayKey}-${dayType}`} className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} />
                                <span className="text-[10px] font-semibold tracking-wide" style={{ color: colors.textSecondary }}>
                                  {meta.label}
                                </span>
                              </div>
                            );
                          })
                        )}
                        {dayTypes.length > 3 ? (
                          <p className="text-[10px] font-semibold" style={{ color: colors.textMuted }}>
                            +{dayTypes.length - 3} more
                          </p>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <aside className="space-y-4 rounded-2xl border p-5 glass-section">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: colors.brandDark }}>
                  Selected Day
                </h2>
                <p className="mt-1 text-sm capitalize" style={{ color: colors.textSecondary }}>
                  {selectedDateLabel}
                </p>
              </div>

              {selectedDayWindows.length === 0 ? (
                <div className="rounded-xl border px-4 py-8 text-center text-sm" style={{ borderColor: colors.border, color: colors.textMuted, backgroundColor: colors.bgSecondary }}>
                  No probabilistic windows for this day.
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDayWindows.map((windowItem, idx) => {
                    const typedWindow = mapWindowType(windowItem.type);
                    const typedMeta = probabilityWindowTypeMeta[typedWindow];
                    const probability = normalizeProbability(windowItem.probabilityScore);
                    return (
                      <article key={`${windowItem.ticker}-${windowItem.type}-${idx}`} className="rounded-xl border p-3 glass-panel">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-bold" style={{ color: colors.brandDark }}>
                            {windowItem.ticker}
                          </h3>
                          <span className="rounded-full px-2.5 py-1 text-[10px] font-semibold" style={{ color: typedMeta.color, backgroundColor: `${typedMeta.color}1A` }}>
                            {typedMeta.label}
                          </span>
                        </div>
                        <p className="mt-2 text-[11px]" style={{ color: colors.textSecondary }}>
                          {formatDateTime(windowItem.windowStart, naDate)} - {formatDateTime(windowItem.windowEnd, naDate)}
                        </p>
                        <div className="mt-3 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span style={{ color: colors.textMuted }}>Probability</span>
                            <span className="font-semibold" style={{ color: colors.brandDark }}>
                              {probability}%
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: colors.bgTertiary }}>
                            <div className="h-full rounded-full" style={{ width: `${probability}%`, backgroundColor: colors.brandCyan }} />
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </aside>
          </div>
        )}

        <section className="rounded-2xl border p-4 glass-section">
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: colors.textSecondary }}>
            Legend
          </h2>
          <div className="mt-3 flex flex-wrap gap-4">
            {(Object.keys(probabilityWindowTypeMeta) as ProbabilityWindowType[]).map((legendType) => {
              const legend = probabilityWindowTypeMeta[legendType];
              return (
                <div key={legendType} className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: colors.textPrimary }}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: legend.color }} />
                  {legend.label}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
