import axios from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getCompanyDetail, getDividendAlerts, getDividendIntelligence, type Company } from "../services/api";
import { CompanyLogo } from "../components/CompanyLogo";
import {
  GLASS_INNER_PANEL,
  GLASS_INPUT,
  GLASS_PAGE_SUBTITLE,
  GLASS_PAGE_TITLE,
  GLASS_SECTION,
} from "../components/behavioral-coach/glassStyles";
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

function isDividendIntelligenceNotFound(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 404) return true;
    const body = error.response?.data;
    if (body && typeof body === "object" && "code" in body) {
      const code = String((body as { code: unknown }).code);
      if (code === "NO_DIVIDEND") return true;
    }
  }
  const msg = apiErrorMessage(error).toLowerCase();
  return msg.includes("dividend intelligence not found") || msg.includes("dividend data not found");
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
  const [notFound, setNotFound] = useState(false);

  const loadForSymbol = useCallback(
    async (sym: string) => {
      const s = sym.trim().toUpperCase();
      if (!s) return;

      setLoading(true);
      setError(null);
      setNotFound(false);

      try {
        const companyData = await getCompanyDetail(s).catch(() => null);
        let intel: DividendIntelligence | null = null;
        let alertRows: DividendAlert[] = [];

        try {
          const intelRes = await getDividendIntelligence(s);
          intel = intelRes.data;
        } catch (e) {
          if (!isDividendIntelligenceNotFound(e)) throw e;
        }

        try {
          const alertsRes = await getDividendAlerts(s, 8);
          alertRows = alertsRes.data.alerts;
        } catch {
          alertRows = [];
        }

        setIntelligence(intel);
        setAlerts(alertRows);
        setCompany(companyData);
        setNotFound(intel == null);
      } catch (e) {
        const msg = apiErrorMessage(e);
        setIntelligence(null);
        setAlerts([]);
        setCompany(null);
        setNotFound(false);
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setSymbol(input.trim().toUpperCase() || "AAPL"), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [input]);

  useEffect(() => {
    void loadForSymbol(symbol);
  }, [symbol, loadForSymbol]);

  const trendLabel = useCallback(
    (direction: DividendIntelligence["trendDirection"]) => {
      if (direction === "up") return t("dividendIntelligence.trendImproving", { defaultValue: "Improving" });
      if (direction === "down") return t("dividendIntelligence.trendWeakening", { defaultValue: "Weakening" });
      return t("dividendIntelligence.trendStable", { defaultValue: "Stable" });
    },
    [t],
  );

  const safeScore = useMemo(
    () => (intelligence ? clamp(Math.round(intelligence.safetyScore ?? 0), 0, 100) : null),
    [intelligence],
  );
  const ringColor = useMemo(() => (safeScore != null ? scoreColor(safeScore) : "#94a3b8"), [safeScore]);

  const aiBrief = useMemo(() => {
    if (loading) return t("common.loading", { defaultValue: "Loading..." });
    if (notFound || !intelligence) {
      return t("dividendIntelligence.aiBriefPending", {
        defaultValue: "AI brief will appear once dividend intelligence is available for this symbol.",
      });
    }
    return (
      intelligence.safetyReason ||
      t("dividendIntelligence.aiBriefFallback", {
        defaultValue: "AI has not returned a detailed safety rationale yet.",
      })
    );
  }, [intelligence, loading, notFound, t]);

  const aiAnalysis = useMemo(() => {
    if (loading) return t("common.loading", { defaultValue: "Loading..." });
    if (notFound || !intelligence) {
      return t("dividendIntelligence.aiAnalysisPrompt", {
        defaultValue: "Enter a ticker to generate an AI view on dividend stability and trend.",
      });
    }
    const topAlert = alerts[0]?.message ?? t("dividendIntelligence.noAlerts", { defaultValue: "No new alerts." });
    return t("dividendIntelligence.aiAnalysisSummary", {
      trend: trendLabel(intelligence.trendDirection),
      percentile: intelligence.sectorPercentile,
      alert: topAlert,
      defaultValue: "Trend: {{trend}}. Sector percentile: {{percentile}}. Latest alert: {{alert}}",
    });
  }, [alerts, intelligence, loading, notFound, t, trendLabel]);

  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  const progress = safeScore != null ? (safeScore / 100) * circumference : 0;

  return (
    <div className="min-h-screen text-white">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <header>
          <h1 className={GLASS_PAGE_TITLE}>
            {t("dividendIntelligence.title", { defaultValue: "Dividend Intelligence" })}
          </h1>
          <p className={`mt-2 ${GLASS_PAGE_SUBTITLE}`}>
            {t("dividendIntelligence.subtitle", {
              defaultValue: "Safety score, trend, sector and latest alerts. Enter a ticker — data refreshes automatically.",
            })}
          </p>
        </header>

        {error ? (
          <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 backdrop-blur-md">
            {error}
          </div>
        ) : null}

        {notFound && !loading && !error ? (
          <div className={`${GLASS_INNER_PANEL} border-dashed px-4 py-5 text-sm`}>
            <p className="font-medium text-white">
              {t("dividendIntelligence.emptyTitle", {
                defaultValue: "No dividend intelligence available for this symbol yet.",
              })}
            </p>
            <p className="mt-2 text-[#94a3b8]">
              {t("dividendIntelligence.emptyBody", {
                defaultValue:
                  "Try another ticker or check back after dividend data is synced for this company.",
              })}
            </p>
          </div>
        ) : null}

        <section className={`${GLASS_SECTION} md:p-6`}>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-4">
              <label className="block text-sm">
                <span className="text-xs font-semibold uppercase tracking-widest text-[#94a3b8]">
                  {t("dividendIntelligence.symbol", { defaultValue: "Ticker" })}
                </span>
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value.toUpperCase())}
                  placeholder={t("dividendIntelligence.symbolPlaceholder", { defaultValue: "Enter ticker…" })}
                  autoComplete="off"
                  className={`${GLASS_INPUT} mt-1 block w-full max-w-xs font-mono uppercase`}
                />
              </label>

              <div className="flex items-center gap-3">
                <CompanyLogo symbol={symbol} logoUrl={company?.logoUrl} size="md" shape="rounded" />
                <div>
                  <p className="text-xl font-semibold text-white">{company?.name ?? symbol}</p>
                  <p className="text-xs text-[#94a3b8]">
                    {company?.sector ?? t("dividendIntelligence.unknownSector", { defaultValue: "Unknown sector" })}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">
                  {t("dividendIntelligence.aiBriefLabel", { defaultValue: "AI Brief" })}
                </p>
                <p className="mt-2 text-sm leading-6 text-white/85">{aiBrief}</p>
              </div>
            </div>

            <div
              className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-4 backdrop-blur-xl"
              style={safeScore != null ? { backgroundColor: withAlpha(ringColor, 0.08) } : undefined}
            >
              <svg width="180" height="180" viewBox="0 0 180 180" className="overflow-visible">
                <circle cx="90" cy="90" r={radius} stroke="rgb(255 255 255 / 0.1)" strokeWidth="14" fill="none" />
                {safeScore != null ? (
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
                ) : null}
                <text x="90" y="94" textAnchor="middle" fontSize="34" fontWeight="700" fill="#ffffff">
                  {safeScore ?? "—"}
                </text>
              </svg>
              <p className="mt-2 text-sm font-semibold" style={{ color: safeScore != null ? ringColor : "#94a3b8" }}>
                {safeScore != null
                  ? t("dividendIntelligence.healthScore", { defaultValue: "Safety score" })
                  : t("dividendIntelligence.healthUnavailable", { defaultValue: "Unavailable" })}
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className={GLASS_SECTION}>
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-[#94a3b8]">
                {t("dividendIntelligence.dividendHistory", { defaultValue: "Dividend history" })}
              </h2>
              <span className="text-xs font-semibold text-white/40">
                {t("dividendIntelligence.chartPlaceholder", { defaultValue: "Chart placeholder" })}
              </span>
            </div>
            <div className="mt-4 flex h-56 items-end gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.03] px-4 pb-4 pt-6">
              {[20, 34, 42, 36, 54, 62, 58, 70].map((height, idx) => (
                <div
                  key={`${height}-${idx}`}
                  className="w-full rounded-t-md"
                  style={{
                    height: `${height}%`,
                    backgroundColor:
                      idx % 2 === 0 ? "rgb(34 211 238 / 0.45)" : "rgb(168 85 247 / 0.55)",
                  }}
                />
              ))}
            </div>
          </section>

          <section className={GLASS_SECTION}>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-[#94a3b8]">
              {t("dividendIntelligence.latestSignals", { defaultValue: "Latest dividend signals" })}
            </h2>
            {alerts.length === 0 ? (
              <p className="mt-4 text-sm text-[#94a3b8]">
                {t("dividendIntelligence.noAlerts", { defaultValue: "No new alerts." })}
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {alerts.slice(0, 4).map((alert) => (
                  <li key={`${alert.createdAt}-${alert.alertType}`} className={`${GLASS_INNER_PANEL} px-3 py-2`}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">{alert.alertType}</p>
                    <p className="mt-1 text-sm text-white/85">{alert.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section
          className="rounded-2xl border border-[#a855f7]/30 p-5 shadow-[0_12px_48px_rgba(168,85,247,0.2)] backdrop-blur-xl md:p-6"
          style={{
            background: `linear-gradient(135deg, ${colors.brandDark}, ${colors.brandMedium})`,
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/75">
            {t("dividendIntelligence.aiAnalysisLabel", { defaultValue: "AI Analysis" })}
          </p>
          <p className="mt-3 text-base leading-7 text-white md:text-lg">{aiAnalysis}</p>
        </section>
      </div>
    </div>
  );
}
