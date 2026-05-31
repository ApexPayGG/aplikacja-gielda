import { ArrowTopRightOnSquareIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { AnalysisBrief, type BriefLimitReached } from "../components/AnalysisBrief";
import { CompanyDividendPanel } from "../components/CompanyDividendPanel";
import { MarketSignalsPanel } from "../components/market-signals/MarketSignalsPanel";
import { CompanyPriceChart } from "../components/CompanyPriceChart";
import { EtoroCTAButton } from "../components/EtoroCTAButton";
import { SEOHead } from "../components/SEOHead";
import { CompanyLogo } from "../components/CompanyLogo";
import { WatchlistButton } from "../components/WatchlistButton";
import {
  AccentPanel,
  cn,
  CockpitBand,
  MarketDelta,
  ModuleCTAButton,
  TERMINAL_ACCENT_RAIL_AMBER,
  TERMINAL_ACCENT_RAIL_CYAN,
  TERMINAL_ACCENT_RAIL_LIME,
  TERMINAL_MODULE_PANEL,
  TerminalBadge,
  TerminalButton,
  TerminalPanel,
  TerminalTabs,
  TerminalWorkspacePage,
} from "../components/terminal";
import { getCompanyBrief, getCompanyDetail, getNews, getQuoteHistory } from "../services/api";
import type { AnalysisResponse, Company, NewsRow, QuoteRow } from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";
import { buildSignalsFallbackNews } from "../utils/signalsFallback";

function formatMarketCap(value: number, currency: string, locale: string): string {
  const amountFmt = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const isPl = locale.toLowerCase().startsWith("pl");
  const billionSuffix = isPl ? "mld" : "B";
  const millionSuffix = isPl ? "mln" : "M";
  if (value >= 1_000_000_000) return `${amountFmt.format(value / 1_000_000_000)} ${billionSuffix} ${currency}`;
  if (value >= 1_000_000) return `${amountFmt.format(value / 1_000_000)} ${millionSuffix} ${currency}`;
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

function parseDescriptionMeta(
  description: string,
  locale: string,
  t: (key: string, options?: Record<string, unknown>) => string,
): { chips: Array<{ id: string; label: string; value: string }>; narrative: string | null } {
  const labelMap: Record<string, string> = {
    Market: t("company.meta.market", { defaultValue: "Market" }),
    Exchange: t("company.meta.exchange", { defaultValue: "Exchange" }),
    Country: t("company.meta.country", { defaultValue: "Country" }),
    Currency: t("company.meta.currency", { defaultValue: "Currency" }),
    MarketCap: t("company.meta.marketCap", { defaultValue: "Market cap" }),
    Sector: t("company.meta.sector", { defaultValue: "Sector" }),
    Industry: t("company.meta.industry", { defaultValue: "Industry" }),
  };
  const skipInChips = new Set(["pe", "p/e", "peratio"]);
  const chips: Array<{ id: string; label: string; value: string }> = [];
  const narrativeParts: string[] = [];

  for (const segment of description.split(";").map((s) => s.trim()).filter(Boolean)) {
    const eq = segment.indexOf("=");
    if (eq === -1) {
      narrativeParts.push(segment);
      continue;
    }
    const key = segment.slice(0, eq).trim();
    const rawValue = segment.slice(eq + 1).trim();
    if (skipInChips.has(key.toLowerCase())) continue;
    if (key.toLowerCase() === "marketcap") {
      const parsed = parseNumber(rawValue);
      const currency = extractMetric(description, ["Currency"])?.toUpperCase() ?? "USD";
      chips.push({
        id: key,
        label: labelMap.MarketCap,
        value: parsed ? formatMarketCap(parsed, currency, locale) : rawValue,
      });
      continue;
    }
    chips.push({
      id: key,
      label: labelMap[key] ?? key,
      value: rawValue,
    });
  }

  const narrative = narrativeParts.join(" ").trim();
  return {
    chips,
    narrative: narrative ? formatCompanyDescription(narrative, locale) : null,
  };
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

const PREMIUM_LOCKED_MODULES = [
  {
    id: "verdict",
    titleKey: "company.premium.module.verdict",
    benefitKey: "company.premium.module.verdictBenefit",
    defaultTitle: "Executive verdict",
    defaultBenefit: "One-screen institutional stance on quality, momentum, and risk.",
  },
  {
    id: "valuation",
    titleKey: "company.premium.module.valuation",
    benefitKey: "company.premium.module.valuationBenefit",
    defaultTitle: "Valuation context",
    defaultBenefit: "Where price sits versus history, peers, and implied expectations.",
  },
  {
    id: "scenarios",
    titleKey: "company.premium.module.scenarios",
    benefitKey: "company.premium.module.scenariosBenefit",
    defaultTitle: "Bull / base / bear scenarios",
    defaultBenefit: "Structured upside and downside paths with explicit drivers.",
  },
  {
    id: "risk",
    titleKey: "company.premium.module.risk",
    benefitKey: "company.premium.module.riskBenefit",
    defaultTitle: "Risk map",
    defaultBenefit: "Ranked threats — macro, fundamental, and event-driven.",
  },
  {
    id: "twins",
    titleKey: "company.premium.module.twins",
    benefitKey: "company.premium.module.twinsBenefit",
    defaultTitle: "Historical twins",
    defaultBenefit: "Analog periods and companies to benchmark outcomes.",
  },
  {
    id: "fit",
    titleKey: "company.premium.module.fit",
    benefitKey: "company.premium.module.fitBenefit",
    defaultTitle: "Personal fit",
    defaultBenefit: "How this name aligns with your profile, horizon, and constraints.",
  },
] as const;

function PremiumAnalysisLockedPreview({
  premiumHref,
  symbol,
}: {
  premiumHref: string;
  symbol: string;
}) {
  const { t } = useTranslation();

  return (
    <AccentPanel variant="cyan" className="p-2.5 sm:p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-terminal-cyan">
            {t("company.premium.previewEyebrow", { defaultValue: "Locked preview" })}
          </p>
          <h2 className="mt-0.5 text-sm font-semibold text-terminal-text">
            {t("company.tabs.premiumAnalysis", { defaultValue: "Premium Analysis" })}
          </h2>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-terminal-textSecondary">
            {t("company.premium.previewLead", {
              symbol,
              defaultValue: "Unlock the full institutional-style analysis for {{symbol}}.",
            })}
          </p>
        </div>
        <TerminalBadge variant="warning" className="shrink-0 font-mono text-[10px] uppercase">
          {t("company.premium.lockedBadge", { defaultValue: "Locked" })}
        </TerminalBadge>
      </div>

      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {PREMIUM_LOCKED_MODULES.map((mod) => (
          <li
            key={mod.id}
            className="flex gap-2 rounded-md border border-terminal-borderMuted/80 bg-terminal-bgAlt/40 px-2.5 py-2"
          >
            <LockClosedIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-terminal-textMuted" aria-hidden />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-terminal-text">
                {t(mod.titleKey, { defaultValue: mod.defaultTitle })}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-terminal-textMuted">
                {t(mod.benefitKey, { defaultValue: mod.defaultBenefit })}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-terminal-borderMuted/80 pt-3">
        <Link to={premiumHref}>
          <ModuleCTAButton variant="primary" size="sm">
            {t("company.premiumOpen", { defaultValue: "Open Premium Analysis" })}
          </ModuleCTAButton>
        </Link>
        <p className="text-[10px] text-terminal-textMuted">
          {t("company.premium.usageNote", {
            defaultValue: "Included in premium analysis usage limits.",
          })}
        </p>
      </div>
    </AccentPanel>
  );
}

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
    return buildSignalsFallbackNews(
      {
        symbol: sym,
        sector: company?.sector,
        industry: company?.industry,
      },
      t,
    );
  }, [news, sym, company?.sector, company?.industry, t]);

  const descriptionMeta = useMemo(() => {
    if (!company?.description) return { chips: [] as Array<{ id: string; label: string; value: string }>, narrative: null as string | null };
    return parseDescriptionMeta(company.description, currentLang, t);
  }, [company?.description, currentLang, t]);

  const panelTitleClass =
    "font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-terminal-textMuted";

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
        <div className="mx-auto max-w-[90rem] px-4 py-16 text-center text-sm text-terminal-textMuted">
          {t("company.loading", { defaultValue: "Loading company..." })}
        </div>
      </>
    );
  }

  if (error || !company) {
    return (
      <>
        <SEOHead title={seoTitle} description={seoDescription} structuredData={seoStructuredData} />
        <div className="mx-auto max-w-[90rem] px-4 py-16">
          <p className="text-sm text-terminal-negative">{error ?? t("company.notFound", { defaultValue: "Company not found" })}</p>
          <Link to="/companies" className="mt-3 inline-block text-sm text-terminal-cyan hover:underline">
            {t("company.backToCompanies", { defaultValue: "← Companies" })}
          </Link>
        </div>
      </>
    );
  }

  const ohlcItems = [
    { label: "Open", value: formatPrice(latestQuote ? Number(latestQuote.open) : null, currentLang) },
    { label: "High", value: formatPrice(latestQuote ? Number(latestQuote.high) : null, currentLang) },
    { label: "Low", value: formatPrice(latestQuote ? Number(latestQuote.low) : null, currentLang) },
    { label: "Close", value: formatPrice(latestQuote ? Number(latestQuote.close) : null, currentLang) },
    { label: "Volume", value: formatVolume(latestQuote ? Number(latestQuote.volume) : null, currentLang) },
  ];

  return (
    <>
      <SEOHead title={seoTitle} description={seoDescription} structuredData={seoStructuredData} />
      <TerminalWorkspacePage
        dense
        className="pb-3"
        contentClassName="space-y-2"
        eyebrow={t("company.eyebrow", { defaultValue: "Stock analysis" })}
        title={company.name}
        subtitle={
          <span className="font-mono text-terminal-cyan">{company.symbol}</span>
        }
        actions={
          <Link to="/companies">
            <TerminalButton variant="ghost" size="sm">
              {t("company.backToCompanies", { defaultValue: "← Companies" })}
            </TerminalButton>
          </Link>
        }
      >
        <CockpitBand>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <CompanyLogo symbol={company.symbol} logoUrl={company.logoUrl} size="lg" shape="rounded" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <TerminalBadge variant="ai" className="font-mono">
                    {company.symbol}
                  </TerminalBadge>
                  {company.exchange ? (
                    <TerminalBadge variant="default" className="uppercase">
                      {company.exchange}
                    </TerminalBadge>
                  ) : null}
                  {etoroMarket ? (
                    <TerminalBadge variant="default" className="uppercase text-amber-300/90">
                      {etoroMarket}
                    </TerminalBadge>
                  ) : null}
                  <WatchlistButton symbol={company.symbol} />
                </div>
                {company.webUrl ? (
                  <a
                    href={company.webUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 inline-flex max-w-full items-center gap-1 truncate text-[11px] text-terminal-cyan hover:underline"
                  >
                    <span className="truncate">{company.webUrl}</span>
                    <ArrowTopRightOnSquareIcon className="h-3 w-3 shrink-0" />
                  </a>
                ) : null}
              </div>
            </div>

            <div className="flex w-full shrink-0 flex-col gap-2 sm:max-w-xs lg:items-end lg:text-right">
              <div>
                <p className={panelTitleClass}>{t("company.lastClose", { defaultValue: "Last close" })}</p>
                <div className="mt-0.5 flex flex-wrap items-baseline gap-2 lg:justify-end">
                  <span className="font-mono text-2xl font-bold tabular-nums text-terminal-text sm:text-3xl">
                    {formatPrice(latestClose, currentLang)}
                  </span>
                  {changePct != null && Number.isFinite(changePct) ? (
                    <MarketDelta value={changePct} />
                  ) : (
                    <span className="text-xs text-terminal-textMuted">{formatSignedPercent(changePct, currentLang)}</span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <Link to={premiumHref}>
                  <ModuleCTAButton variant="primary" size="sm">
                    {t("company.premiumAnalysis", { defaultValue: "Premium Analysis" })}
                  </ModuleCTAButton>
                </Link>
              </div>
            </div>
          </div>

          {etoroMarket ? (
            <AccentPanel variant="amber" showRail className="mt-2.5 p-2 sm:p-2.5">
              <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-amber-300/75">
                {t("company.partnerRail", { defaultValue: "Partner / compliance" })}
              </p>
              <EtoroCTAButton
                sourcePage="company_detail"
                ticker={sym}
                className="mt-1.5 [&_button]:!w-auto [&_button]:!py-1.5 [&_button]:!text-xs [&_div.rounded-lg]:!border-amber-400/20 [&_div.rounded-lg]:!bg-terminal-panelSecondary/60 [&_div.rounded-lg]:!p-2 [&_div.rounded-lg]:!text-[11px]"
              />
            </AccentPanel>
          ) : null}
        </CockpitBand>

        <TerminalTabs
          tabs={tabs}
          activeId={activeTab}
          onChange={setActiveTab}
          ariaLabel={t("company.tabsLabel", { defaultValue: "Company sections" })}
        />

        <div className="space-y-2">
          {activeTab === "overview" ? (
            <section className="grid gap-2 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
              <div className="space-y-2">
                <TerminalPanel className={cn(TERMINAL_ACCENT_RAIL_CYAN, "p-2.5 sm:p-3")}>
                  <h2 className={panelTitleClass}>{t("company.priceChart", { defaultValue: "Price chart" })}</h2>
                  <div className="mt-2">
                    <CompanyPriceChart quotes={sortedQuotes} sessionOhlc={sessionOhlc} />
                  </div>
                </TerminalPanel>

                <div className={cn(TERMINAL_MODULE_PANEL, "p-2.5 sm:p-3")}>
                  <h2 className={panelTitleClass}>
                    {t("company.ohlcSession", { defaultValue: "Latest session (OHLCV)" })}
                  </h2>
                  <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-5">
                    {ohlcItems.map((item) => (
                      <div
                        key={item.label}
                        className="rounded-md border border-terminal-borderMuted bg-terminal-bgAlt/50 px-2 py-1.5"
                      >
                        <p className="font-mono text-[9px] uppercase tracking-wide text-terminal-textMuted">
                          {item.label}
                        </p>
                        <p className="mt-0.5 font-mono text-xs font-semibold tabular-nums text-terminal-text">
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <TerminalPanel className={cn(TERMINAL_ACCENT_RAIL_LIME, "p-2.5 sm:p-3")}>
                <h2 className={panelTitleClass}>
                  {t("company.fundamentals", { defaultValue: "Fundamentals" })}
                </h2>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {fundamentals.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-md border border-terminal-borderMuted bg-terminal-bgAlt/50 px-2 py-1.5"
                    >
                      <p className="font-mono text-[9px] uppercase tracking-wide text-terminal-textMuted">
                        {item.label}
                      </p>
                      <p className="mt-0.5 text-xs font-semibold text-terminal-text">{item.value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {company.sector ? (
                    <TerminalBadge variant="default">
                      {t("company.meta.sector", { defaultValue: "Sector" })}: {company.sector}
                    </TerminalBadge>
                  ) : null}
                  {company.industry ? (
                    <TerminalBadge variant="ai">
                      {t("company.meta.industry", { defaultValue: "Industry" })}: {company.industry}
                    </TerminalBadge>
                  ) : null}
                  {descriptionMeta.chips.map((chip) => (
                    <TerminalBadge key={chip.id} variant="default">
                      {chip.label}: {chip.value}
                    </TerminalBadge>
                  ))}
                </div>
                {descriptionMeta.narrative ? (
                  <p className="mt-2 text-xs leading-relaxed text-terminal-textSecondary">
                    {descriptionMeta.narrative}
                  </p>
                ) : null}
              </TerminalPanel>
            </section>
          ) : null}

          {activeTab === "ai-brief" ? (
            <AccentPanel variant="cyan" className="p-2.5 sm:p-3">
              <AnalysisBrief
                variant="terminal"
                analysis={analysis}
                loading={analysisLoading}
                error={analysisError}
                limitReached={analysisLimit}
              />
            </AccentPanel>
          ) : null}

          {activeTab === "signals" ? (
            <div className="space-y-2">
              <section>
                <MarketSignalsPanel ticker={sym} lookbackDays={30} />
              </section>
              <TerminalPanel className={cn(TERMINAL_ACCENT_RAIL_CYAN, "p-2.5 sm:p-3")}>
                <h2 className={cn(panelTitleClass, "text-terminal-text")}>
                  {t("company.signals.newsHeading", { defaultValue: "News headlines" })}
                </h2>
                <ul className="mt-2 divide-y divide-terminal-borderMuted rounded-md border border-terminal-border">
                  {displayNews.map((n) => (
                    <li key={`${n.id}-${n.timestamp}`} className="px-3 py-2">
                      {n.url && n.url !== "#" ? (
                        <a
                          href={n.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-terminal-text hover:text-terminal-cyan hover:underline"
                        >
                          {n.title}
                        </a>
                      ) : (
                        <p className="text-sm font-medium text-terminal-text">{n.title}</p>
                      )}
                      <p className="mt-0.5 font-mono text-[10px] text-terminal-textMuted">
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
              </TerminalPanel>
            </div>
          ) : null}

          {activeTab === "dividend" ? (
            <TerminalPanel className={cn(TERMINAL_ACCENT_RAIL_AMBER, "p-2.5 sm:p-3")}>
              <CompanyDividendPanel
                symbol={sym}
                locale={currentLang}
                companyName={companyName}
                onBackToOverview={() => setActiveTab("overview")}
              />
            </TerminalPanel>
          ) : null}

          {activeTab === "premium-analysis" ? (
            <PremiumAnalysisLockedPreview premiumHref={premiumHref} symbol={sym} />
          ) : null}
        </div>

        {etoroMarket ? (
          <p className="text-[10px] leading-snug text-terminal-textMuted/80">
            {t("etoro.company.disclaimer", {
              defaultValue: "CFDs involve risk. 76% of retail accounts lose money.",
            })}
          </p>
        ) : null}
      </TerminalWorkspacePage>
    </>
  );
}
