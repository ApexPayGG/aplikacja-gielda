import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { EtoroCTAButton } from "../components/EtoroCTAButton";
import { SignalsFilter } from "../components/SignalsFilter";
import { ShareButton } from "../components/ShareButton";
import { useAuth } from "../context/AuthContext";
import { useSignalsFilter } from "../hooks/useSignalsFilter";
import { api } from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";
import { colors } from "../styles/designSystem";

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

const companyMetaByTicker: Record<string, { companyName: string; logoUrl: string | null }> = {
  AAPL: { companyName: "Apple Inc.", logoUrl: null },
  PKN: { companyName: "ORLEN S.A.", logoUrl: null },
  SAP: { companyName: "SAP SE", logoUrl: null },
  "7203": { companyName: "Toyota Motor", logoUrl: null },
  MSFT: { companyName: "Microsoft Corp.", logoUrl: null },
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

function isEndpointMissing(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 404;
}

function unpackSignalRows(data: unknown): unknown[] {
  if (!data || typeof data !== "object") return [];
  const rowLike = data as Record<string, unknown>;
  if (Array.isArray(rowLike.data)) return rowLike.data;
  if (Array.isArray(rowLike.items)) return rowLike.items;
  if (Array.isArray(rowLike.signals)) return rowLike.signals;
  if (Array.isArray(rowLike.signalUpdates)) return rowLike.signalUpdates;
  return [];
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

  const logoInput = row.logoUrl ?? row.logo ?? null;
  const logoUrl = typeof logoInput === "string" && logoInput.trim() ? logoInput.trim() : companyMetaByTicker[ticker]?.logoUrl ?? null;
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
  const { token } = useAuth();
  const isLoggedIn = Boolean(token);
  const [signals, setSignals] = useState<SignalListItem[]>([]);
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
        const { data } = await api.get<Record<string, unknown>>("/signals", { params: { limit: 20 } });
        const rows = unpackSignalRows(data)
          .map((row) => parseSignal(row))
          .filter((row): row is SignalListItem => row !== null);

        if (!cancelled) {
          setSignals(rows.length > 0 ? rows : mockSignals);
        }
      } catch (error) {
        if (cancelled) return;
        if (isEndpointMissing(error)) {
          setSignals(mockSignals);
        } else {
          setListError(apiErrorMessage(error));
          setSignals([]);
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

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary }}>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <header className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold" style={{ color: colors.brandDark }}>
              Sygnały
            </h1>
            <p className="max-w-2xl text-sm" style={{ color: colors.textSecondary }}>
              Przeglądaj aktywne setupy i ocenę ryzyka według nowego design systemu AMC Energy.
            </p>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.textMuted }}>
              Wyniki: {filteredSignals.length}
            </p>
            <EtoroCTAButton sourcePage="signals" className="max-w-xs" />
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
                  <div
                    key={`skeleton-${idx}`}
                    className="animate-pulse rounded-2xl border p-5"
                    style={{ borderColor: colors.border, backgroundColor: colors.bgSecondary }}
                  >
                    <div className="mb-4 h-5 w-1/3 rounded" style={{ backgroundColor: colors.bgTertiary }} />
                    <div className="mb-2 h-4 w-4/5 rounded" style={{ backgroundColor: colors.bgTertiary }} />
                    <div className="h-4 w-2/5 rounded" style={{ backgroundColor: colors.bgTertiary }} />
                  </div>
                ))}
              </div>
            ) : null}

            {!loadingList && listError ? (
              <div
                className="rounded-2xl border px-4 py-3 text-sm"
                style={{
                  borderColor: colors.negative,
                  color: colors.negative,
                  backgroundColor: `${colors.negative}12`,
                }}
              >
                {listError}
              </div>
            ) : null}

            {!loadingList && !listError && filteredSignals.length === 0 ? (
              <div
                className="rounded-2xl border px-4 py-6 text-center text-sm"
                style={{ borderColor: colors.border, color: colors.textSecondary, backgroundColor: colors.bgSecondary }}
              >
                Brak sygnałów dla wybranego filtra.
              </div>
            ) : null}

            {!loadingList && !listError && filteredSignals.length > 0 ? (
              <div className="space-y-4">
                {filteredSignals.map((signal) => {
                  const isPositive = signal.changePct >= 0;
                  const isHovered = hoveredSignalId === signal.id;
                  const signedChangeForShare = `${signal.changePct >= 0 ? "+" : ""}${signal.changePct.toFixed(1)}%`;
                  return (
                    <article
                      key={signal.id}
                      className="rounded-2xl border p-5 transition"
                      style={{
                        backgroundColor: colors.bgPrimary,
                        borderColor: isHovered ? colors.brandCyan : colors.border,
                        boxShadow: isHovered ? "0 12px 28px rgba(13, 13, 26, 0.08)" : "0 2px 8px rgba(13, 13, 26, 0.05)",
                      }}
                      onMouseEnter={() => setHoveredSignalId(signal.id)}
                      onMouseLeave={() => setHoveredSignalId(null)}
                    >
                      <div className="grid gap-4 md:grid-cols-[2.2fr_1.2fr_1.2fr] md:items-center">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border text-sm font-bold uppercase"
                            style={{
                              borderColor: colors.borderStrong,
                              backgroundColor: colors.bgSecondary,
                              color: colors.brandDark,
                            }}
                          >
                            {signal.logoUrl ? (
                              <img src={signal.logoUrl} alt={`${signal.companyName} logo`} className="h-full w-full object-cover" />
                            ) : (
                              signal.ticker.slice(0, 2)
                            )}
                          </div>
                          <div>
                            <p className="text-lg font-bold" style={{ color: colors.brandDark }}>
                              {signal.ticker}
                            </p>
                            <p className="text-sm" style={{ color: colors.textSecondary }}>
                              {signal.companyName}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <span
                            className="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
                            style={{ backgroundColor: colors.brandCyan, color: colors.brandDark }}
                          >
                            {signal.setupType}
                          </span>
                          <p className="text-4xl font-bold leading-none" style={{ color: colors.brandDark }}>
                            {Math.round(signal.riskScore)}
                          </p>
                        </div>

                        <div className="text-left md:text-right">
                          <p className="text-2xl font-semibold" style={{ color: colors.textPrimary }}>
                            ${formatPrice(signal.price)}
                          </p>
                          <span
                            className="mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold"
                            style={{
                              backgroundColor: `${isPositive ? colors.positive : colors.negative}1A`,
                              color: isPositive ? colors.positive : colors.negative,
                            }}
                          >
                            {signal.changePct >= 0 ? "+" : ""}
                            {signal.changePct.toFixed(2)}%
                          </span>
                          <div className="mt-3 flex md:justify-end">
                            <ShareButton
                              label={`Udostępnij sygnał ${signal.ticker} ${signedChangeForShare}`}
                              url={`https://stock-ai.pro/signals/${signal.id}`}
                              twitterText={`🚀 Sygnał AI: ${signal.ticker} ${signal.setupType} | Score: ${Math.round(signal.riskScore)}/100 | StockAI Pro #inwestowanie #GPW`}
                            />
                          </div>
                        </div>
                      </div>

                      <div
                        className="relative mt-5 overflow-hidden rounded-xl border"
                        style={{ borderColor: colors.border, backgroundColor: colors.bgSecondary }}
                      >
                        <div className="space-y-2 p-4 blur-[2px]" style={{ opacity: isLoggedIn ? 1 : 0.72 }}>
                          <div className="h-2.5 w-3/4 rounded" style={{ backgroundColor: colors.bgTertiary }} />
                          <div className="h-2.5 w-11/12 rounded" style={{ backgroundColor: colors.bgTertiary }} />
                          <div className="h-2.5 w-2/3 rounded" style={{ backgroundColor: colors.bgTertiary }} />
                        </div>
                        {!isLoggedIn ? (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/75 px-4 text-center">
                            <p className="text-sm font-semibold" style={{ color: colors.brandDark }}>
                              Zaloguj się aby zobaczyć analizę AI
                            </p>
                            <Link
                              to="/register"
                              className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                              style={{ color: colors.bgPrimary, backgroundColor: colors.brandDark }}
                            >
                              Zaloguj się
                            </Link>
                          </div>
                        ) : (
                          <div className="absolute inset-0 flex items-center px-4 text-xs" style={{ color: colors.textSecondary }}>
                            Analiza AI dostępna w podglądzie premium dla tego sygnału.
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <button
        type="button"
        className="fixed bottom-4 right-4 z-30 rounded-full px-5 py-3 text-sm font-semibold shadow-lg lg:hidden"
        style={{ backgroundColor: colors.brandDark, color: colors.bgPrimary }}
        onClick={() => setIsMobileFiltersOpen(true)}
      >
        Filtry {hasActiveFilters ? "•" : ""}
      </button>

      {isMobileFiltersOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            onClick={() => setIsMobileFiltersOpen(false)}
            aria-label="Zamknij panel filtrów"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[86vh] overflow-y-auto rounded-t-3xl border p-4" style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary }}>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-base font-bold" style={{ color: colors.brandDark }}>
                Filtry sygnałów
              </p>
              <button type="button" className="text-sm font-semibold" style={{ color: colors.brandCyan }} onClick={() => setIsMobileFiltersOpen(false)}>
                Zamknij
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
  );
}
