import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getCompanyDetail, getDividendAlerts, getDividendIntelligence, type Company } from "../services/api";
import { BrandLogo } from "../components/BrandLogo";
import { colors } from "../styles/designSystem";
import type { DividendAlert, DividendIntelligence } from "../types/dividend";
import { apiErrorMessage } from "../utils/apiErrorMessage";

const DEBOUNCE_MS = 450;

function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return hex;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function scoreColor(score: number): string {
  if (score > 70) return colors.positive;
  if (score >= 40) return colors.brandGold;
  return colors.negative;
}

function formatTrendLabel(direction: DividendIntelligence["trendDirection"]): string {
  if (direction === "up") return "Improving";
  if (direction === "down") return "Weakening";
  return "Stable";
}

export function DividendIntelligencePage() {
  const { t } = useTranslation();
  const [input, setInput] = useState("AAPL");
  const [symbol, setSymbol] = useState("AAPL");
  const [intelligence, setIntelligence] = useState<DividendIntelligence | null>(null);
  const [alerts, setAlerts] = useState<DividendAlert[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadForSymbol = useCallback(async (sym: string) => {
    const s = sym.trim().toUpperCase();
    if (!s) return;

    setLoading(true);
    setError(null);

    try {
      const [intelRes, alertsRes, companyData] = await Promise.all([
        getDividendIntelligence(s),
        getDividendAlerts(s, 8),
        getCompanyDetail(s).catch(() => null),
      ]);
      setIntelligence(intelRes.data);
      setAlerts(alertsRes.data.alerts);
      setCompany(companyData);
    } catch (e) {
      const msg = apiErrorMessage(e);
      setIntelligence(null);
      setAlerts([]);
      setCompany(null);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setSymbol(input.trim().toUpperCase() || "AAPL"), DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [input]);

  useEffect(() => {
    void loadForSymbol(symbol);
  }, [symbol, loadForSymbol]);

  const safeScore = useMemo(() => clamp(Math.round(intelligence?.safetyScore ?? 0), 0, 100), [intelligence?.safetyScore]);
  const ringColor = useMemo(() => scoreColor(safeScore), [safeScore]);
  const aiBrief = useMemo(() => {
    if (!intelligence) {
      return "AI brief pojawi się po pobraniu danych dla wskazanej spółki.";
    }
    return intelligence.safetyReason || "AI nie zwróciło jeszcze szczegółowego uzasadnienia safety score.";
  }, [intelligence]);
  const aiAnalysis = useMemo(() => {
    if (!intelligence) {
      return "Wprowadź ticker, aby wygenerować analizę AI dotyczącą stabilności i trendu dywidendy.";
    }
    const topAlert = alerts[0]?.message ?? "Brak nowych alertów.";
    return `Trend: ${formatTrendLabel(intelligence.trendDirection)}. Percentyl sektorowy: ${intelligence.sectorPercentile}. Najnowszy alert: ${topAlert}`;
  }, [alerts, intelligence]);

  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  const progress = (safeScore / 100) * circumference;

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.bgSecondary, color: colors.textPrimary }}>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <header>
          <h1 className="text-4xl font-bold tracking-tight">
            {t("dividendIntelligence.title", { defaultValue: "Dividend Intelligence" })}
          </h1>
          <p className="mt-2 text-sm md:text-base" style={{ color: colors.textSecondary }}>
            {t("dividendIntelligence.subtitle", {
              defaultValue: "AI-powered review of dividend quality, stability and latest market signals.",
            })}
          </p>
        </header>

        {error ? (
          <div
            className="rounded-xl border px-4 py-3 text-sm"
            style={{
              borderColor: colors.negative,
              color: colors.negative,
              backgroundColor: withAlpha(colors.negative, 0.08),
            }}
          >
            {error}
          </div>
        ) : null}

        <section className="rounded-2xl border p-5 shadow-sm md:p-6 glass-section">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-4">
              <label className="block text-sm">
                <span className="font-semibold" style={{ color: colors.textSecondary }}>
                  {t("dividendIntelligence.symbol", { defaultValue: "Symbol" })}
                </span>
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value.toUpperCase())}
                  placeholder="AAPL"
                  autoComplete="off"
                  className="mt-1 block w-full max-w-xs rounded-xl border px-3 py-2 font-mono uppercase outline-none"
                  style={{
                    borderColor: colors.borderStrong,
                    backgroundColor: colors.bgPrimary,
                    color: colors.textPrimary,
                  }}
                />
              </label>

              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg p-1">
                  <BrandLogo size="mini" className="h-full max-h-10 w-full object-contain" />
                </div>
                <div>
                  <p className="text-xl font-semibold">{company?.name ?? symbol}</p>
                  <p className="text-xs" style={{ color: colors.textMuted }}>
                    {company?.sector ?? "Unknown sector"}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.textSecondary }}>
                  AI Brief
                </p>
                <p className="mt-2 text-sm leading-6" style={{ color: colors.textPrimary }}>
                  {loading ? t("common.loading", { defaultValue: "Loading..." }) : aiBrief}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-center rounded-2xl px-6 py-4" style={{ backgroundColor: withAlpha(ringColor, 0.08) }}>
              <svg width="180" height="180" viewBox="0 0 180 180" className="overflow-visible">
                <circle cx="90" cy="90" r={radius} stroke={colors.bgTertiary} strokeWidth="14" fill="none" />
                <circle
                  cx="90"
                  cy="90"
                  r={radius}
                  stroke={ringColor}
                  strokeWidth="14"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${progress} ${circumference - progress}`}
                  transform="rotate(-90 90 90)"
                />
                <text x="90" y="94" textAnchor="middle" fontSize="34" fontWeight="700" fill={colors.textPrimary}>
                  {safeScore}
                </text>
              </svg>
              <p className="mt-2 text-sm font-semibold" style={{ color: ringColor }}>
                Health score
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border p-5 shadow-sm glass-section">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: colors.textSecondary }}>
                Historia dywidend
              </h2>
              <span className="text-xs font-semibold" style={{ color: colors.textMuted }}>
                Chart placeholder
              </span>
            </div>
            <div
              className="mt-4 flex h-56 items-end gap-2 rounded-xl border border-dashed px-4 pb-4 pt-6"
              style={{
                borderColor: colors.borderStrong,
                backgroundColor: withAlpha(colors.bgTertiary, 0.8),
              }}
            >
              {[20, 34, 42, 36, 54, 62, 58, 70].map((height, idx) => (
                <div
                  key={`${height}-${idx}`}
                  className="w-full rounded-t-md"
                  style={{
                    height: `${height}%`,
                    backgroundColor: idx % 2 === 0 ? withAlpha(colors.brandCyan, 0.55) : withAlpha(colors.brandGold, 0.75),
                  }}
                />
              ))}
            </div>
          </section>

          <section className="rounded-2xl border p-5 shadow-sm glass-section">
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: colors.textSecondary }}>
              Latest dividend signals
            </h2>
            {alerts.length === 0 ? (
              <p className="mt-4 text-sm" style={{ color: colors.textSecondary }}>
                Brak nowych alertów.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {alerts.slice(0, 4).map((alert) => (
                  <li key={`${alert.createdAt}-${alert.alertType}`} className="rounded-xl border px-3 py-2" style={{ borderColor: colors.border }}>
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.textMuted }}>
                      {alert.alertType}
                    </p>
                    <p className="mt-1 text-sm">{alert.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section
          className="rounded-2xl p-5 shadow-lg md:p-6"
          style={{
            color: colors.bgPrimary,
            background: `linear-gradient(135deg, ${colors.brandDark}, ${colors.brandMedium})`,
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: withAlpha(colors.bgPrimary, 0.8) }}>
            AI Analysis
          </p>
          <p className="mt-3 text-base leading-7 md:text-lg">{aiAnalysis}</p>
        </section>
      </div>
    </div>
  );
}
