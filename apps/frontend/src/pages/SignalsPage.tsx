import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { Link } from "react-router-dom";
import { InvestmentDisclaimer } from "../components/InvestmentDisclaimer";
import { EtoroCTAButton } from "../components/EtoroCTAButton";
import { SignalsFilter } from "../components/SignalsFilter";
import { ExportButton } from "../components/ExportButton";
import { ShareButton } from "../components/ShareButton";
import { VirtualList } from "../components/VirtualList";
import { useAuth } from "../context/AuthContext";
import { useSignalsFilter } from "../hooks/useSignalsFilter";
import { getSignalsFeed } from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";
import { enrichItemsWithCompanyLogos } from "../utils/companyLogoEnrichment";
import { CompanyLogo } from "../components/CompanyLogo";
import {
  TERMINAL_APP_BG,
  TERMINAL_BUTTON_PRIMARY,
  TERMINAL_MOBILE_FILTER_SHEET,
  TERMINAL_PAGE_SHELL,
  TERMINAL_PAGE_SUBTITLE,
  TERMINAL_PAGE_TITLE,
  TERMINAL_PANEL_MUTED,
  TERMINAL_SECTION_TITLE,
  TERMINAL_SHELL_OVERLAY,
  TERMINAL_SIGNAL_CARD,
  TERMINAL_SIGNAL_CARD_HOVER,
  TERMINAL_SIGNAL_INNER,
} from "../components/terminal/terminalStyles";

type SignalListItem = {
  id: string;
  ticker: string;
  companyName: string;
  logoUrl: string | null;
  setupType: string;
  riskScore: number;
  exchange: string | null;
  createdAt: string;
  changePct: number;
  price: number;
};

const companyMetaByTicker: Record<string, { companyName: string }> = {
  AAPL: { companyName: "Apple Inc." },
  PKN: { companyName: "ORLEN S.A." },
  SAP: { companyName: "SAP SE" },
  "7203": { companyName: "Toyota Motor" },
  MSFT: { companyName: "Microsoft Corp." },
};

const mockSignals: SignalListItem[] = [
  {
    id: "sig-1001",
    ticker: "AAPL",
    companyName: "Apple Inc.",
    logoUrl: null,
    riskScore: 86,
    setupType: "Breakout",
    exchange: "US",
    createdAt: new Date().toISOString(),
    changePct: 2.4,
    price: 192.41,
  },
  {
    id: "sig-1002",
    ticker: "PKN",
    companyName: "ORLEN S.A.",
    logoUrl: null,
    riskScore: 64,
    setupType: "Support Bounce",
    exchange: "GPW",
    createdAt: new Date(Date.now() - 86_400_000).toISOString(),
    changePct: -0.8,
    price: 69.2,
  },
  {
    id: "sig-1003",
    ticker: "SAP",
    companyName: "SAP SE",
    logoUrl: null,
    riskScore: 79,
    setupType: "Volume Spike",
    exchange: "DAX",
    createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    changePct: 1.1,
    price: 184.5,
  },
  {
    id: "sig-1004",
    ticker: "7203",
    companyName: "Toyota Motor",
    logoUrl: null,
    riskScore: 55,
    setupType: "Oversold",
    exchange: "HK",
    createdAt: new Date(Date.now() - 11 * 86_400_000).toISOString(),
    changePct: -2.1,
    price: 3280,
  },
  {
    id: "sig-1005",
    ticker: "MSFT",
    companyName: "Microsoft Corp.",
    logoUrl: null,
    riskScore: 82,
    setupType: "Momentum continuation",
    exchange: "US",
    createdAt: new Date(Date.now() - 27 * 86_400_000).toISOString(),
    changePct: 1.8,
    price: 428.3,
  },
];

const SIGNAL_ROW_HEIGHT = 360;

/** Set VITE_ENABLE_DEMO_SIGNALS=true locally to show sample cards when /api/signals is missing (404). */
const DEMO_SIGNALS_ENABLED = import.meta.env.VITE_ENABLE_DEMO_SIGNALS === "true";

type SignalsFeedSource = "api" | "empty" | "demo";

function isEndpointMissing(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 404;
}

function parseSignal(raw: unknown): SignalListItem | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = String(row.id ?? "").trim();
  const ticker = String(row.ticker ?? row.symbol ?? "").trim().toUpperCase();
  if (!id || !ticker) return null;

  const companyNameFromApi = String(row.companyName ?? row.name ?? row.company ?? "").trim();
  const companyNameFromMap = companyMetaByTicker[ticker]?.companyName;
  const companyName = companyNameFromApi || companyNameFromMap || `${ticker} Company`;

  const rawLogo = row.logoUrl ?? row.logo;
  const logoUrl = typeof rawLogo === "string" && rawLogo.trim() ? rawLogo.trim() : null;
  const createdAt = String(row.createdAt ?? row.timestamp ?? row.updatedAt ?? row.date ?? new Date().toISOString());
  const exchange = String(row.exchange ?? row.market ?? row.marketCode ?? "").trim() || null;

  return {
    id,
    ticker,
    companyName,
    logoUrl,
    riskScore: Number(row.riskScore ?? row.score ?? 0) || 0,
    setupType: String(row.setupType ?? row.setup ?? "Unknown setup"),
    exchange,
    createdAt,
    changePct: Number(row.changePct ?? row.changePercent ?? 0) || 0,
    price: Number(row.price ?? 0) || 0,
  };
}

function formatPrice(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function SignalsPage() {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const isLoggedIn = Boolean(token);
  const [signals, setSignals] = useState<SignalListItem[]>([]);
  const [feedSource, setFeedSource] = useState<SignalsFeedSource>("empty");
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [hoveredSignalId, setHoveredSignalId] = useState<string | null>(null);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const { filters, hasActiveFilters, toggleSetupType, setRiskScoreMin, toggleExchange, setTimeframe, setSortBy, resetFilters, applyFilters } =
    useSignalsFilter();
  useEffect(() => {
    let cancelled = false;
    async function loadSignals(): Promise<void> {
      setLoadingList(true);
      setListError(null);
      try {
        const feed = await getSignalsFeed(200);
        const rows = feed
          .map((row) =>
            parseSignal({
              id: row.id,
              ticker: row.ticker,
              companyName: row.companyName,
              logoUrl: row.logoUrl,
              setupType: row.setupType,
              riskScore: row.riskScore,
              exchange: row.exchange,
              createdAt: row.createdAt,
              changePct: row.changePct,
              price: row.price,
            }),
          )
          .filter((row): row is SignalListItem => row !== null);

        if (cancelled) return;

        if (rows.length > 0) {
          const enriched = await enrichItemsWithCompanyLogos(rows);
          setSignals(enriched);
          setFeedSource("api");
        } else {
          setSignals([]);
          setFeedSource("empty");
        }
      } catch (error) {
        if (cancelled) return;
        if (isEndpointMissing(error) && DEMO_SIGNALS_ENABLED) {
          const enriched = await enrichItemsWithCompanyLogos(mockSignals);
          setSignals(enriched);
          setFeedSource("demo");
        } else if (isEndpointMissing(error)) {
          setSignals([]);
          setFeedSource("empty");
        } else {
          setListError(apiErrorMessage(error));
          setSignals([]);
          setFeedSource("empty");
        }
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    }
    void loadSignals();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredSignals = useMemo(() => {
    return applyFilters(signals);
  }, [signals, applyFilters]);

  const shouldVirtualize = filteredSignals.length > 50;

  const renderSignalCard = (signal: SignalListItem) => {
    const isPositive = signal.changePct >= 0;
    const isHovered = hoveredSignalId === signal.id;
    const signedChangeForShare = `${signal.changePct >= 0 ? "+" : ""}${signal.changePct.toFixed(1)}%`;
    return (
      <article
        key={signal.id}
        className={`h-full ${TERMINAL_SIGNAL_CARD} ${isHovered ? TERMINAL_SIGNAL_CARD_HOVER : "hover:border-terminal-cyan/25"}`}
        onMouseEnter={() => setHoveredSignalId(signal.id)}
        onMouseLeave={() => setHoveredSignalId(null)}
      >
        <div className="grid gap-4 md:grid-cols-[2.2fr_1.2fr_1.2fr] md:items-center">
          <div className="flex items-center gap-3">
            <CompanyLogo symbol={signal.ticker} logoUrl={signal.logoUrl} size="md" shape="rounded" />
            <div>
              <p className="font-mono text-lg font-bold text-terminal-cyan">{signal.ticker}</p>
              <p className="text-sm text-terminal-textSecondary">{signal.companyName}</p>
            </div>
          </div>

          <div className="space-y-2">
            <span className="inline-flex rounded-full border border-terminal-cyan/30 bg-terminal-cyan/15 px-3 py-1 text-xs font-semibold text-terminal-cyan">
              {signal.setupType}
            </span>
            <p className="font-mono text-4xl font-bold leading-none text-terminal-text">{Math.round(signal.riskScore)}</p>
          </div>

          <div className="text-left md:text-right">
            <p className="font-mono text-2xl font-semibold text-terminal-text">${formatPrice(signal.price)}</p>
            <span
              className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                isPositive
                  ? "border border-terminal-positive/30 bg-terminal-positive/10 text-terminal-positive"
                  : "border border-terminal-negative/30 bg-terminal-negative/10 text-terminal-negative"
              }`}
            >
              {signal.changePct >= 0 ? "+" : ""}
              {signal.changePct.toFixed(2)}%
            </span>
            <div className="mt-3 flex md:justify-end">
              <ShareButton
                label={t("signals.shareSignal", {
                  ticker: signal.ticker,
                  change: signedChangeForShare,
                  defaultValue: `Share signal ${signal.ticker} ${signedChangeForShare}`,
                })}
                url={`https://stock-ai.pro/signals/${signal.id}`}
                twitterText={t("signals.shareTwitter", {
                  ticker: signal.ticker,
                  setup: signal.setupType,
                  score: Math.round(signal.riskScore),
                  defaultValue: `AI signal: ${signal.ticker} ${signal.setupType} | Score: ${Math.round(signal.riskScore)}/100 | StockAI Pro`,
                })}
              />
            </div>
          </div>
        </div>

        <div className={`${TERMINAL_SIGNAL_INNER} relative mt-5 overflow-hidden`}>
          <div className={`space-y-2 p-4 blur-[2px] ${isLoggedIn ? "opacity-100" : "opacity-70"}`}>
            <div className="mb-2 h-2.5 w-3/4 rounded bg-terminal-borderMuted" />
            <div className="mb-2 h-2.5 w-11/12 rounded bg-terminal-borderMuted" />
            <div className="h-2.5 w-2/3 rounded bg-terminal-borderMuted" />
          </div>
          {!isLoggedIn ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-terminal-bg/80 px-4 text-center backdrop-blur-sm">
              <p className="text-sm font-semibold text-terminal-text">{t("signals.loginForAi", { defaultValue: "Sign in to view AI analysis" })}</p>
              <Link to="/register" className={`${TERMINAL_BUTTON_PRIMARY} px-3 py-1.5 text-xs`}>
                {t("signals.signIn", { defaultValue: "Sign in" })}
              </Link>
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center px-4 text-xs text-terminal-textMuted">
              {t("signals.aiPreview", { defaultValue: "AI analysis preview is available for this signal." })}
            </div>
          )}
        </div>
      </article>
    );
  };

  return (
    <div className={TERMINAL_APP_BG}>
      <div className={`${TERMINAL_PAGE_SHELL} py-4 sm:py-6`}>
        <header className="mb-6 flex flex-col gap-5 border-b border-terminal-borderMuted pb-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className={TERMINAL_SECTION_TITLE}>
              {t("signals.eyebrow", { defaultValue: "Signal scanner" })}
            </p>
            <h1 className={TERMINAL_PAGE_TITLE}>{t("signals.title", { defaultValue: "Signals" })}</h1>
            <p className={TERMINAL_PAGE_SUBTITLE}>
              {t("signals.pageSubtitle", {
                defaultValue: "Browse active setups and AI-supported risk assessments.",
              })}
            </p>
            <InvestmentDisclaimer variant="drawer" className="max-w-2xl text-left" showTermsLink />
            <p className={TERMINAL_SECTION_TITLE}>
              {t("signals.resultsCount", { defaultValue: "Results" })}: {filteredSignals.length}
            </p>
            <EtoroCTAButton sourcePage="signals" className="max-w-xs" />
          </div>
          <div className="self-start md:self-auto">
            <ExportButton
              endpoint="/export/signals"
              userId={user?.id}
              label={t("signals.exportSignals", { defaultValue: "Export signals" })}
            />
          </div>
        </header>
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <SignalsFilter
                filters={filters}
                onToggleSetupType={toggleSetupType}
                onRiskScoreChange={setRiskScoreMin}
                onToggleExchange={toggleExchange}
                onTimeframeChange={setTimeframe}
                onSortByChange={setSortBy}
                onReset={resetFilters}
              />
            </div>
          </aside>

          <div className="space-y-4">
            {loadingList ? (
              <div className="space-y-4">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={`skeleton-${idx}`} className={`${TERMINAL_PANEL_MUTED} animate-pulse p-5`}>
                    <div className="mb-4 h-5 w-1/3 rounded bg-terminal-panelSecondary" />
                    <div className="mb-2 h-4 w-4/5 rounded bg-terminal-panelSecondary" />
                    <div className="h-4 w-2/5 rounded bg-terminal-panelSecondary" />
                  </div>
                ))}
              </div>
            ) : null}

            {!loadingList && listError ? (
              <div className="rounded-lg border border-terminal-negative/30 bg-terminal-negative/10 px-4 py-3 text-sm text-terminal-negative">
                {listError}
              </div>
            ) : null}

            {!loadingList && !listError && feedSource === "demo" ? (
              <div
                className="rounded-lg border border-terminal-warning/35 bg-terminal-warning/10 px-4 py-3 text-sm font-medium text-terminal-warning"
                role="status"
              >
                {t("signals.demoBanner", {
                  defaultValue: "Demo signals — sample data for preview only, not live market feed.",
                })}
              </div>
            ) : null}

            {!loadingList && !listError && signals.length === 0 ? (
              <div className={`${TERMINAL_PANEL_MUTED} px-4 py-6 text-center text-sm text-terminal-textSecondary`}>
                <p>
                  {t("signals.emptyFeed", {
                    defaultValue: "No active signals right now. New setups will appear when the scanner finds matches.",
                  })}
                </p>
              </div>
            ) : null}

            {!loadingList && !listError && signals.length > 0 && filteredSignals.length === 0 ? (
              <div className={`${TERMINAL_PANEL_MUTED} px-4 py-6 text-center text-sm text-terminal-textSecondary`}>
                {t("signals.emptyFiltered", { defaultValue: "No signals for the selected filter." })}
              </div>
            ) : null}

            {!loadingList && !listError && filteredSignals.length > 0 ? (
              shouldVirtualize ? (
                <VirtualList
                  items={filteredSignals}
                  itemHeight={SIGNAL_ROW_HEIGHT}
                  getItemKey={(signal) => signal.id}
                  renderItem={(signal) => <div className="pb-4">{renderSignalCard(signal)}</div>}
                />
              ) : (
                <div className="space-y-4">{filteredSignals.map((signal) => renderSignalCard(signal))}</div>
              )
            ) : null}
          </div>
        </div>

        <button
          type="button"
          className={`fixed bottom-20 right-4 z-30 rounded-full px-5 py-3 text-sm font-semibold shadow-terminal-glow lg:hidden md:bottom-4 ${TERMINAL_BUTTON_PRIMARY}`}
          onClick={() => setIsMobileFiltersOpen(true)}
        >
          {t("signals.mobileFilters", { defaultValue: "Filters" })} {hasActiveFilters ? "•" : ""}
        </button>

        {isMobileFiltersOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              className={`absolute inset-0 ${TERMINAL_SHELL_OVERLAY} opacity-100`}
              onClick={() => setIsMobileFiltersOpen(false)}
              aria-label={t("signals.closeFiltersPanel", { defaultValue: "Close filter panel" })}
            />
            <div className={TERMINAL_MOBILE_FILTER_SHEET}>
              <div className="mb-4 flex items-center justify-between">
                <p className="text-base font-bold text-terminal-text">{t("signals.filtersTitle", { defaultValue: "Signal filters" })}</p>
                <button type="button" className="text-sm font-semibold text-terminal-cyan" onClick={() => setIsMobileFiltersOpen(false)}>
                  {t("common.close", { defaultValue: "Close" })}
                </button>
              </div>
            <SignalsFilter
              filters={filters}
              onToggleSetupType={toggleSetupType}
              onRiskScoreChange={setRiskScoreMin}
              onToggleExchange={toggleExchange}
              onTimeframeChange={setTimeframe}
              onSortByChange={setSortBy}
              onReset={resetFilters}
            />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
