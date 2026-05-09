import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { AnalysisBrief } from "../components/AnalysisBrief";
import { Chart } from "../components/Chart";
import type { AnalysisResponse, Company, NewsRow, QuoteRow } from "../services/api";
import { getAnalysis, getCompanyDetail, getNews, getQuoteHistory } from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";

export function CompanyDetail() {
  const { t } = useTranslation();
  const { symbol = "" } = useParams();
  const sym = decodeURIComponent(symbol).toUpperCase();

  const [company, setCompany] = useState<Company | null>(null);
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [news, setNews] = useState<NewsRow[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

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
        const a = await getAnalysis(sym);
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
  }, [sym]);

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
        {t("company.backCompanies", { defaultValue: "<- Companies" })}
      </Link>

      <div className="mb-10 flex flex-col gap-8 md:flex-row md:items-start">
        <div className="flex h-36 w-full max-w-[200px] shrink-0 items-center justify-center rounded-2xl border border-surface-border bg-slate-900/60 p-4 md:h-44">
          {company.logoUrl ? (
            <img src={company.logoUrl} alt="" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-4xl font-bold text-slate-600">{company.symbol.slice(0, 2)}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold text-white">{company.name}</h1>
          <p className="mt-1 font-mono text-sm text-slate-500">{company.symbol}</p>
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
            <p className="mt-4 text-sm leading-relaxed text-slate-400">{company.description}</p>
          )}
        </div>
      </div>

      <div className="mb-10">
        <Chart quotes={quotes} title={t("company.chartTitle", { defaultValue: "Close - recent history" })} />
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
                {new Date(n.timestamp).toLocaleString()} · {n.source}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <AnalysisBrief analysis={analysis} loading={analysisLoading} error={analysisError} />
    </div>
  );
}
