import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { AnalysisBrief } from "../components/AnalysisBrief";
import { BrokerCTAButton } from "../components/affiliate/BrokerCTAButton";
import { Chart } from "../components/Chart";
import { WatchlistButton } from "../components/WatchlistButton";
import type { AnalysisResponse, Company, NewsRow, QuoteRow } from "../services/api";
import { getCompanyBrief, getCompanyDetail, getNews, getQuoteHistory } from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";

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
  const etoroMarket = toEtoroMarket(company?.exchange);

  useEffect(() => {
    const companyName = company?.name?.trim() || sym;
    document.title = `${sym} — ${companyName} | StockAI Pro`;

    const descriptionText = company?.description?.trim()
      ? `${sym} (${companyName}) na StockAI Pro: ${company.description.slice(0, 160)}`
      : `${sym} (${companyName}) na StockAI Pro: notowania, wykres, newsy i analiza AI.`;

    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement("meta");
      metaDescription.setAttribute("name", "description");
      document.head.appendChild(metaDescription);
    }
    metaDescription.setAttribute("content", descriptionText);
  }, [company, sym]);

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
      try {
        const a = await getCompanyBrief(sym, currentLang);
        if (!cancelled) setAnalysis(a);
      } catch (e) {
        if (!cancelled) setAnalysisError(apiErrorMessage(e));
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
      <div className="mx-auto max-w-4xl px-4 py-20 text-center text-slate-500">
        {t("company.loading", { defaultValue: "Loading company..." })}
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20">
        <p className="text-red-300">{error ?? "Company not found"}</p>
        <Link to="/" className="mt-4 inline-block text-accent-muted hover:underline">
          {t("company.backHome", { defaultValue: "<- Back home" })}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link to="/" className="mb-6 inline-block text-sm text-accent-muted hover:underline">
        {t("company.backToCompanies", { defaultValue: "← Companies" })}
      </Link>

      <div className="mb-10 flex flex-col gap-8 md:flex-row md:items-start">
        <div className="flex h-36 w-full max-w-[200px] shrink-0 items-center justify-center rounded-2xl border border-surface-border bg-slate-900/60 p-4 md:h-44">
          {company.logoUrl ? (
            <img src={company.logoUrl} alt="" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-4xl font-bold text-slate-600">{company.symbol.slice(0, 3)}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold text-white">{company.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <p className="font-mono text-sm text-slate-500">{company.symbol}</p>
            <WatchlistButton symbol={company.symbol} />
          </div>
          {etoroMarket && (
            <section className="mt-4 rounded-xl border border-brand-green/30 bg-brand-green/5 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-green">
                {t("etoro.company.title", { defaultValue: "Trade this stock" })}
              </h2>
              <div className="mt-3">
                <BrokerCTAButton
                  ticker={company.symbol}
                  sourcePage="company_detail"
                  market={etoroMarket}
                  brokerSlug="etoro"
                  size="medium"
                  variant="primary"
                  label={t("etoro.company.button", { defaultValue: "Open account on eToro" })}
                  showDisclosure={false}
                  icon={
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-2 text-xs font-bold text-[#00c853]">
                      eToro
                    </span>
                  }
                />
                <p className="mt-2 text-xs text-slate-300">
                  {t("etoro.company.disclaimer", {
                    defaultValue: "CFDs involve risk. 76% of retail accounts lose money.",
                  })}
                </p>
              </div>
            </section>
          )}
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">{t("company.sector", { defaultValue: "Sector" })}</dt>
              <dd className="text-slate-200">{company.sector}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{t("company.industry", { defaultValue: "Industry" })}</dt>
              <dd className="text-slate-200">{company.industry}</dd>
            </div>
            {company.webUrl && (
              <div className="sm:col-span-2">
                <dt className="text-slate-500">{t("company.website", { defaultValue: "Website" })}</dt>
                <dd>
                  <a
                    href={company.webUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-accent-muted hover:underline"
                  >
                    {company.webUrl}
                    <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                  </a>
                </dd>
              </div>
            )}
          </dl>
          {company.description && (
            <p className="mt-4 text-sm leading-relaxed text-slate-400">
              {formatCompanyDescription(company.description, currentLang)}
            </p>
          )}
        </div>
      </div>

      <div className="mb-10">
        <Chart quotes={quotes} title={t("company.chartTitle", { defaultValue: "Close - recent history" })} />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <BrokerCTAButton
            ticker={company.symbol}
            sourcePage="company_detail"
            size="medium"
            variant="primary"
          />
          <Link
            to={`/company/${encodeURIComponent(company.symbol)}/premium`}
            className="rounded-lg border border-brand-blue/60 bg-brand-blue/10 px-4 py-2 text-sm font-medium text-brand-blue transition hover:bg-brand-blue/20"
          >
            Open Premium Analysis
          </Link>
        </div>
      </div>

      <div className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-white">{t("company.recentNews", { defaultValue: "Recent news" })}</h2>
        <ul className="divide-y divide-surface-border rounded-2xl border border-surface-border bg-surface-elevated">
          {news.length === 0 && (
            <li className="px-4 py-6 text-sm text-slate-500">
              {t("company.noNews", { defaultValue: "No news rows in database yet." })}
            </li>
          )}
          {news.map((n) => (
            <li key={`${n.id}-${n.timestamp}`} className="px-4 py-3">
              <a
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-accent-muted hover:underline"
              >
                {n.title}
              </a>
              <p className="mt-1 text-xs text-slate-500">
                {new Date(n.timestamp).toLocaleDateString(i18n.resolvedLanguage || "en", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}{" "}
                · {n.source}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <AnalysisBrief analysis={analysis} loading={analysisLoading} error={analysisError} />
    </div>
  );
}
