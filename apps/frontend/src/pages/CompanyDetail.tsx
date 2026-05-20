import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { AnalysisBrief, type BriefLimitReached } from "../components/AnalysisBrief";
import { CompanyDividendPanel } from "../components/CompanyDividendPanel";
import { CompanyPriceChart } from "../components/CompanyPriceChart";
import { EtoroCTAButton } from "../components/EtoroCTAButton";
import { SEOHead } from "../components/SEOHead";
import { BrandLogo } from "../components/BrandLogo";
import { WatchlistButton } from "../components/WatchlistButton";
import { colors } from "../styles/designSystem";
import { getCompanyBrief, getCompanyDetail, getNews, getQuoteHistory } from "../services/api";
import type { AnalysisResponse, Company, NewsRow, QuoteRow } from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";
import { buildSignalsFallbackNews } from "../utils/signalsFallback";

function formatMarketCap(value: number, currency: string, locale: string): string {
  const amountFmt = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (value >= 1_000_000_000) return `${amountFmt.format(value / 1_000_000_000)} mld ${currency}`;
  if (value >= 1_000_000) return `${amountFmt.format(value / 1_000_000)} mln ${currency}`;
  return `${new Intl.NumberFormat(locale).format(value)} ${currency}`;
}

function formatCompanyDescription(description: string, locale: string): string {
  return description.replace(/MarketCap=(\d+(?:\.\d+)?);\s*Currency=([A-Z]{3})/g, (_m, rawValue, currency) => {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) return `${rawValue} ${currency}`;
    return formatMarketCap(parsed, currency, locale);
  });
}

function formatPrice(value: number | null, locale: string): string {
  if (!Number.isFinite(value ?? Number.NaN)) return "N/A";
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value ?? 0);
}

function formatVolume(value: number | null, locale: string): string {
  if (!Number.isFinite(value ?? Number.NaN)) return "N/A";
  return new Intl.NumberFormat(locale).format(value ?? 0);
}

function formatSignedPercent(value: number | null, locale: string): string {
  if (!Number.isFinite(value ?? Number.NaN)) return "N/A";
  const sign = (value ?? 0) >= 0 ? "+" : "";
  return `${sign}${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value ?? 0)}%`;
}

function extractMetric(description: string | null | undefined, keys: string[]): string | null {
  if (!description) return null;
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = description.match(new RegExp(`${escaped}\\s*=\\s*([^;\\n]+)`, "i"));
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function parseNumber(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/,/g, "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function toEtoroMarket(exchangeRaw?: string | null): "US" | "EU" | null {
  const exchange = String(exchangeRaw ?? "").trim().toUpperCase();
  if (!exchange) return null;
  if (exchange === "US" || exchange === "NYSE" || exchange === "NASDAQ" || exchange === "AMEX") return "US";
  const euExchanges = new Set([
    "LSE",
    "XETRA",
    "FRA",
    "PA",
    "AS",
    "MI",
    "MC",
    "SW",
    "VIE",
    "BR",
    "ST",
    "HE",
    "DE",
    "EU",
  ]);
  return euExchanges.has(exchange) ? "EU" : null;
}

type CompanyTabId = "overview" | "ai-brief" | "signals" | "dividend" | "premium-analysis";

export function CompanyDetail() {
  const { t, i18n } = useTranslation();
  const { symbol = "" } = useParams();
  const sym = decodeURIComponent(symbol).toUpperCase();
  const currentLang = i18n.resolvedLanguage || i18n.language || "en";

  const [company, setCompany] = useState<Company | null>(null);
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [news, setNews] = useState<NewsRow[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisLimit, setAnalysisLimit] = useState<BriefLimitReached | null>(null);
  const [activeTab, setActiveTab] = useState<CompanyTabId>("overview");
  const tabs = useMemo(
    (): Array<{ id: CompanyTabId; label: string }> => [
      { id: "overview", label: t("company.tabs.overview", { defaultValue: "Overview" }) },
      { id: "ai-brief", label: t("company.tabs.aiBrief", { defaultValue: "AI Brief" }) },
      { id: "signals", label: t("company.tabs.signals", { defaultValue: "Signals" }) },
      { id: "dividend", label: t("company.tabs.dividend", { defaultValue: "Dividend" }) },
      { id: "premium-analysis", label: t("company.tabs.premiumAnalysis", { defaultValue: "Premium Analysis" }) },
    ],
    [t],
  );
  const companyName = company?.name?.trim() || sym;
  const seoTitle = `${sym} — ${companyName} | StockAI Pro`;
  const seoDescription = `AI analysis of ${companyName}. Risk score, signals, dividend data and Premium Analysis.`;
  const seoStructuredData = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "FinancialProduct",
      name: companyName,
      tickerSymbol: sym,
    }),
    [companyName, sym],
  );
  const etoroMarket = toEtoroMarket(company?.exchange);
  const sortedQuotes = useMemo(
    () => [...quotes].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
    [quotes],
  );
  const latestQuote = sortedQuotes.at(-1) ?? null;
  const previousQuote = sortedQuotes.length > 1 ? sortedQuotes.at(-2) ?? null : null;
  const latestClose = latestQuote ? Number(latestQuote.close) : null;
  const previousClose = previousQuote ? Number(previousQuote.close) : null;
  const changePct =
    Number.isFinite(latestClose) && Number.isFinite(previousClose) && (previousClose ?? 0) !== 0
      ? (((latestClose ?? 0) - (previousClose ?? 0)) / (previousClose ?? 0)) * 100
      : null;
  const quoteHighs = sortedQuotes.map((q) => Number(q.high)).filter((value) => Number.isFinite(value));
  const quoteLows = sortedQuotes.map((q) => Number(q.low)).filter((value) => Number.isFinite(value));
  const trailingHigh = quoteHighs.length ? Math.max(...quoteHighs) : null;
  const trailingLow = quoteLows.length ? Math.min(...quoteLows) : null;
  const currentVolume = latestQuote ? Number(latestQuote.volume) : null;
  const parsedMarketCap = parseNumber(extractMetric(company?.description, ["MarketCap"]));
  const parsedPe = extractMetric(company?.description, ["P/E", "PE", "PERatio"]);
  const parsedCurrency = extractMetric(company?.description, ["Currency"])?.toUpperCase() ?? "USD";
  const premiumHref = `/company/${encodeURIComponent(sym)}/premium`;
  const fundamentals = [
    { label: "P/E", value: parsedPe ?? "N/A" },
    {
      label: "Market Cap",
      value: parsedMarketCap ? formatMarketCap(parsedMarketCap, parsedCurrency, currentLang) : "N/A",
    },
    { label: "Volume", value: formatVolume(currentVolume, currentLang) },
    { label: "52w High", value: formatPrice(trailingHigh, currentLang) },
    { label: "52w Low", value: formatPrice(trailingLow, currentLang) },
    { label: "Currency", value: parsedCurrency },
  ];
  const sessionOhlc = latestQuote
    ? {
        open: Number(latestQuote.open),
        high: Number(latestQuote.high),
        low: Number(latestQuote.low),
        close: Number(latestQuote.close),
      }
    : null;
  const displayNews = useMemo(() => {
    if (news.length > 0) return news;
    return buildSignalsFallbackNews({
      symbol: sym,
      sector: company?.sector,
      industry: company?.industry,
    });
  }, [news, sym, company?.sector, company?.industry]);

  useEffect(() => {
    if (!sym) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [co, hist, nw] = await Promise.all([
          getCompanyDetail(sym),
          getQuoteHistory(sym, 45),
          getNews(sym, 8),
        ]);
        if (!cancelled) {
          setCompany(co);
          setQuotes(hist.data);
          setNews(nw);
        }
      } catch (e) {
        if (!cancelled) setError(apiErrorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sym]);

  useEffect(() => {
    if (!sym) return;
    let cancelled = false;
    (async () => {
      setAnalysisLoading(true);
      setAnalysisError(null);
      setAnalysisLimit(null);
      try {
        const a = await getCompanyBrief(sym, currentLang);
        if (!cancelled) setAnalysis(a);
      } catch (e) {
        if (!cancelled) {
          if (axios.isAxiosError(e) && e.response?.status === 429) {
            const body = e.response.data as { error?: string; limit?: number };
            if (body?.error === "LIMIT_REACHED") {
              setAnalysis(null);
              setAnalysisLimit({ limit: typeof body.limit === "number" ? body.limit : 3 });
              setAnalysisError(null);
              return;
            }
          }
          setAnalysisLimit(null);
          setAnalysisError(apiErrorMessage(e));
        }
      } finally {
        if (!cancelled) setAnalysisLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sym, currentLang]);

  if (loading && !company) {
    return (
      <>
        <SEOHead title={seoTitle} description={seoDescription} structuredData={seoStructuredData} />
        <div className="mx-auto max-w-4xl px-4 py-20 text-center text-slate-500">
          {t("company.loading", { defaultValue: "Loading company..." })}
        </div>
      </>
    );
  }

  if (error || !company) {
    return (
      <>
        <SEOHead title={seoTitle} description={seoDescription} structuredData={seoStructuredData} />
        <div className="mx-auto max-w-4xl px-4 py-20">
          <p className="text-red-300">{error ?? t("company.notFound", { defaultValue: "Company not found" })}</p>
          <Link to="/companies" className="mt-4 inline-block hover:underline" style={{ color: colors.brandMedium }}>
            {t("company.backToCompanies", { defaultValue: "← Companies" })}
          </Link>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen">
      <SEOHead title={seoTitle} description={seoDescription} structuredData={seoStructuredData} />
      <div className="mx-auto max-w-[1280px] px-4 py-6 lg:px-6">
        <Link to="/companies" className="mb-4 inline-block text-sm hover:underline" style={{ color: colors.brandMedium }}>
          {t("company.backToCompanies", { defaultValue: "← Companies" })}
        </Link>

        <section
          className="rounded-2xl border p-4 shadow-sm lg:p-5"
          style={{ borderColor: colors.border, backgroundColor: colors.bgSecondary }}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div
                className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border"
                style={{ borderColor: colors.borderStrong, backgroundColor: colors.bgPrimary }}
              >
                <BrandLogo size="cardLg" className="max-h-16 w-full object-contain" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-semibold lg:text-3xl" style={{ color: colors.textPrimary }}>
                  {company.name}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className="rounded-md px-2 py-1 text-xs font-semibold"
                    style={{ backgroundColor: colors.bgTertiary, color: colors.textSecondary }}
                  >
                    {company.symbol}
                  </span>
                  {company.exchange ? (
                    <span
                      className="rounded-md px-2 py-1 text-xs font-semibold uppercase"
                      style={{ backgroundColor: "#eef2ff", color: colors.brandDark }}
                    >
                      {company.exchange}
                    </span>
                  ) : null}
                  <WatchlistButton symbol={company.symbol} />
                </div>
                {company.webUrl ? (
                  <a
                    href={company.webUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs hover:underline"
                    style={{ color: colors.brandMedium }}
                  >
                    {company.webUrl}
                    <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>
            </div>
            <div className="w-full max-w-sm lg:text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: colors.textMuted }}>
                {t("company.lastClose", { defaultValue: "Last close" })}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2 lg:justify-end">
                <span className="font-mono text-4xl font-semibold" style={{ color: colors.brandDark }}>
                  {formatPrice(latestClose, currentLang)}
                </span>
                <span
                  className="rounded-md px-2 py-1 text-xs font-semibold"
                  style={{
                    backgroundColor:
                      changePct == null ? colors.bgTertiary : (changePct ?? 0) >= 0 ? "rgba(0, 168, 107, 0.14)" : "rgba(229, 57, 53, 0.14)",
                    color: changePct == null ? colors.textSecondary : (changePct ?? 0) >= 0 ? colors.positive : colors.negative,
                  }}
                >
                  {formatSignedPercent(changePct, currentLang)}
                </span>
              </div>
              {etoroMarket ? (
                <EtoroCTAButton sourcePage="company_detail" ticker={sym} className="mt-3" />
              ) : null}
              <Link
                to={premiumHref}
                className="mt-2 inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white lg:w-auto"
                style={{
                  backgroundImage: `linear-gradient(90deg, ${colors.brandDark} 0%, ${colors.brandMedium} 100%)`,
                }}
              >
                {t("company.premiumAnalysis", { defaultValue: "Premium Analysis" })}
              </Link>
            </div>
          </div>
        </section>

        <div className="mt-4 border-b" style={{ borderColor: colors.border }}>
          <nav
            role="tablist"
            aria-label={t("company.tabsLabel", { defaultValue: "Company sections" })}
            className="-mb-px flex flex-wrap gap-2"
          >
            {tabs.map((tab) => {
              const isActive = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className="rounded-t-lg border px-4 py-2 text-sm font-semibold transition"
                  style={{
                    borderColor: colors.border,
                    backgroundColor: isActive ? colors.bgSecondary : colors.bgPrimary,
                    color: isActive ? colors.brandDark : colors.textSecondary,
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="mt-4">
          {activeTab === "overview" ? (
            <section className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
              <div className="space-y-4">
                <article
                  className="rounded-xl border p-4"
                  style={{ borderColor: colors.border, backgroundColor: colors.bgSecondary }}
                >
                  <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: colors.textSecondary }}>
                    {t("company.priceChart", { defaultValue: "Price chart" })}
                  </h2>
                  <div className="mt-3">
                    <CompanyPriceChart quotes={sortedQuotes} sessionOhlc={sessionOhlc} />
                  </div>
                </article>

                <article
                  className="rounded-xl border p-4"
                  style={{ borderColor: colors.border, backgroundColor: colors.bgSecondary }}
                >
                  <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: colors.textSecondary }}>
                    {t("company.ohlcSession", { defaultValue: "Latest session (OHLCV)" })}
                  </h2>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                    {[
                      { label: "Open", value: formatPrice(latestQuote ? Number(latestQuote.open) : null, currentLang) },
                      { label: "High", value: formatPrice(latestQuote ? Number(latestQuote.high) : null, currentLang) },
                      { label: "Low", value: formatPrice(latestQuote ? Number(latestQuote.low) : null, currentLang) },
                      { label: "Close", value: formatPrice(latestQuote ? Number(latestQuote.close) : null, currentLang) },
                      { label: "Volume", value: formatVolume(latestQuote ? Number(latestQuote.volume) : null, currentLang) },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="rounded-lg border px-3 py-2"
                        style={{ borderColor: colors.borderStrong, backgroundColor: colors.bgPrimary }}
                      >
                        <p className="text-xs uppercase tracking-wide" style={{ color: colors.textMuted }}>
                          {item.label}
                        </p>
                        <p className="mt-1 font-mono text-sm font-semibold" style={{ color: colors.textPrimary }}>
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </article>
              </div>

              <div className="space-y-4">
                <article
                  className="rounded-xl border p-4"
                  style={{ borderColor: colors.border, backgroundColor: colors.bgSecondary }}
                >
                  <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: colors.textSecondary }}>
                    Fundamentals
                  </h2>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {fundamentals.map((item) => (
                      <div
                        key={item.label}
                        className="rounded-lg border px-3 py-2"
                        style={{ borderColor: colors.borderStrong, backgroundColor: colors.bgPrimary }}
                      >
                        <p className="text-xs uppercase tracking-wide" style={{ color: colors.textMuted }}>
                          {item.label}
                        </p>
                        <p className="mt-1 text-sm font-semibold" style={{ color: colors.textPrimary }}>
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span
                      className="rounded-full px-3 py-1 text-xs font-semibold"
                      style={{ backgroundColor: colors.bgTertiary, color: colors.brandDark }}
                    >
                      Sector: {company.sector || "N/A"}
                    </span>
                    <span
                      className="rounded-full px-3 py-1 text-xs font-semibold"
                      style={{ backgroundColor: colors.bgTertiary, color: colors.brandMedium }}
                    >
                      Industry: {company.industry || "N/A"}
                    </span>
                  </div>
                  {company.description ? (
                    <p className="mt-4 text-sm leading-relaxed" style={{ color: colors.textSecondary }}>
                      {formatCompanyDescription(company.description, currentLang)}
                    </p>
                  ) : null}
                </article>
              </div>
            </section>
          ) : null}

          {activeTab === "ai-brief" ? (
            <section
              className="rounded-xl border p-4"
              style={{ borderColor: colors.border, backgroundColor: colors.bgSecondary }}
            >
              <AnalysisBrief
                analysis={analysis}
                loading={analysisLoading}
                error={analysisError}
                limitReached={analysisLimit}
              />
            </section>
          ) : null}

          {activeTab === "signals" ? (
            <section
              className="rounded-xl border p-4"
              style={{ borderColor: colors.border, backgroundColor: colors.bgSecondary }}
            >
              <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
                Signals
              </h2>
              <ul className="mt-3 divide-y rounded-lg border" style={{ borderColor: colors.border }}>
                {displayNews.map((n) => (
                  <li key={`${n.id}-${n.timestamp}`} className="px-4 py-3" style={{ borderColor: colors.border }}>
                    {n.url && n.url !== "#" ? (
                      <a
                        href={n.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium hover:underline"
                        style={{ color: colors.brandDark }}
                      >
                        {n.title}
                      </a>
                    ) : (
                      <p className="font-medium" style={{ color: colors.brandDark }}>
                        {n.title}
                      </p>
                    )}
                    <p className="mt-1 text-xs" style={{ color: colors.textMuted }}>
                      {new Date(n.timestamp).toLocaleDateString(i18n.resolvedLanguage || "en", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · {n.source}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {activeTab === "dividend" ? (
            <section
              className="rounded-xl border p-4"
              style={{ borderColor: colors.border, backgroundColor: colors.bgSecondary }}
            >
              <CompanyDividendPanel symbol={sym} locale={currentLang} companyName={companyName} />
            </section>
          ) : null}

          {activeTab === "premium-analysis" ? (
            <section
              className="rounded-xl border p-4"
              style={{ borderColor: colors.border, backgroundColor: colors.bgSecondary }}
            >
              <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
                Premium Analysis
              </h2>
              <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                Unlock advanced narrative, valuation context, and risk scenarios for this company.
              </p>
              <Link
                to={premiumHref}
                className="mt-4 inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white"
                style={{
                  backgroundImage: `linear-gradient(90deg, ${colors.brandDark} 0%, ${colors.brandMedium} 100%)`,
                }}
              >
                Open Premium Analysis
              </Link>
            </section>
          ) : null}
        </div>

        {etoroMarket ? (
          <p className="mt-4 text-xs" style={{ color: colors.textMuted }}>
            {t("etoro.company.disclaimer", {
              defaultValue: "CFDs involve risk. 76% of retail accounts lose money.",
            })}
          </p>
        ) : null}
      </div>
    </div>
  );
}
