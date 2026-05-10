import { FormEvent, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getNewsHalfLife, type NewsHalfLifeItem, type NewsHalfLifeResponse } from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";

function formatDate(value: string, locale: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
}

function remainingPercent(item: NewsHalfLifeItem): number {
  const startedAt = new Date(item.date).getTime();
  const expiresAt = new Date(item.expiresAt).getTime();
  const now = Date.now();
  const duration = Math.max(1, expiresAt - startedAt);
  const left = Math.max(0, expiresAt - now);
  return Math.round((left / duration) * 100);
}

export function NewsHalfLifePage() {
  const { t, i18n } = useTranslation();
  const [symbol, setSymbol] = useState("AAPL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<NewsHalfLifeResponse | null>(null);

  const mostImpactful = useMemo(() => {
    if (!data?.mostImpactful) return null;
    return data.news.find((item) => item.headline === data.mostImpactful?.headline) ?? null;
  }, [data]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const normalized = symbol.trim().toUpperCase();
    if (!normalized) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getNewsHalfLife(normalized);
      setData(result);
      setSymbol(normalized);
    } catch (e) {
      setError(apiErrorMessage(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">{t("newshalflife.title")}</h1>
        <p className="mt-1 text-sm text-slate-400">{t("newshalflife.subtitle")}</p>
      </header>

      <form onSubmit={onSubmit} className="neo-panel mb-8 rounded-2xl p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={symbol}
            onChange={(event) => setSymbol(event.target.value.toUpperCase())}
            placeholder={t("newshalflife.symbolPlaceholder")}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none ring-brand-blue transition focus:ring-2"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-brand-blue px-4 py-2 font-semibold text-white hover:bg-brand-blue/85 disabled:opacity-60"
          >
            {loading ? t("common.loading") : t("newshalflife.searchButton")}
          </button>
        </div>
      </form>

      {error ? (
        <div className="mb-6 rounded-lg border border-brand-red/30 bg-brand-red/10 p-3 text-sm text-brand-red">
          {error}
        </div>
      ) : null}

      {mostImpactful ? (
        <section className="neo-panel mb-6 rounded-2xl border border-brand-amber/40 p-5">
          <p className="text-xs uppercase tracking-wide text-brand-amber">{t("newshalflife.mostImpactful")}</p>
          <h2 className="mt-2 text-xl font-semibold text-white">{mostImpactful.headline}</h2>
          <p className="mt-1 text-sm text-slate-300">
            {t("newshalflife.halfLifeDaysLabel", { days: mostImpactful.halfLifeDays })} •{" "}
            {t("newshalflife.reasonLabel")}: {mostImpactful.reason}
          </p>
        </section>
      ) : null}

      {data && data.news.length === 0 ? <p className="text-slate-400">{t("newshalflife.empty")}</p> : null}

      <section className="space-y-4">
        {data?.news.map((item, idx) => {
          const pct = remainingPercent(item);
          const expired = pct <= 0;
          return (
            <article key={`${item.headline}-${idx}`} className="rounded-2xl border border-slate-700/70 bg-slate-900/50 p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="text-base font-semibold text-white">{item.headline}</h3>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    expired ? "bg-slate-700 text-slate-200" : "bg-brand-blue/25 text-brand-blue"
                  }`}
                >
                  {expired
                    ? t("newshalflife.expired")
                    : t("newshalflife.halfLifeDaysBadge", { days: item.halfLifeDays })}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {formatDate(item.date, i18n.language || "en")} • {t("newshalflife.categoryLabel")}: {item.category}
              </p>
              <p className="mt-1 text-sm text-slate-200">
                {t("newshalflife.reasonLabel")}: {item.reason}
              </p>
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                  <span>{t("newshalflife.remainingLabel")}</span>
                  <span>{pct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full rounded-full ${expired ? "bg-slate-600" : "bg-brand-green"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
