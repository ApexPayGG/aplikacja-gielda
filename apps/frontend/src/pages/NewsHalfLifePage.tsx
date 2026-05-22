import type { TFunction } from "i18next";
import { FormEvent, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getNewsHalfLife, type NewsHalfLifeItem, type NewsHalfLifeResponse } from "../services/api";
import { colors } from "../styles/designSystem";
import { apiErrorMessage } from "../utils/apiErrorMessage";
import { resolveIntlLocale } from "../utils/formatters";

function formatDate(value: string, locale: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString(resolveIntlLocale(locale), { year: "numeric", month: "short", day: "numeric" });
}

type NewsFilter = "All" | "Earnings" | "Fed" | "Geopolitics" | "Company";
const FILTERS: NewsFilter[] = ["All", "Earnings", "Fed", "Geopolitics", "Company"];

function halfLifeLabel(days: number, t: TFunction): string {
  if (days < 3) {
    return t("newshalflife.halfLifeHoursBadge", {
      defaultValue: "{{hours}}h",
      hours: Math.max(1, Math.round(days * 24)),
    });
  }
  return t("newshalflife.halfLifeDaysBadge", {
    defaultValue: "{{days}} days",
    days: Math.round(days),
  });
}

function isLongHalfLife(days: number): boolean {
  return days >= 5;
}

function normalizeCategory(category: string): NewsFilter {
  const normalized = category.trim().toLowerCase();
  if (normalized.includes("earning")) return "Earnings";
  if (normalized.includes("fed")) return "Fed";
  if (normalized.includes("geo")) return "Geopolitics";
  if (normalized.includes("company")) return "Company";
  return "Company";
}

function readSource(item: NewsHalfLifeItem): string {
  const value = (item as NewsHalfLifeItem & { source?: string }).source;
  return value?.trim() || item.category;
}

export function NewsHalfLifePage() {
  const { t, i18n } = useTranslation();
  const [symbol, setSymbol] = useState("AAPL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<NewsHalfLifeResponse | null>(null);
  const [activeFilter, setActiveFilter] = useState<NewsFilter>("All");

  const filteredNews = useMemo(() => {
    if (!data) return [];
    if (activeFilter === "All") return data.news;
    return data.news.filter((item) => normalizeCategory(item.category) === activeFilter);
  }, [activeFilter, data]);

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
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-10" style={{ color: colors.textPrimary }}>
      <header
        className="rounded-3xl border p-6 shadow-[0_18px_42px_rgba(168,85,247,0.1)]"
        style={{ borderColor: colors.border, background: `linear-gradient(130deg, ${colors.bgPrimary}, ${colors.bgSecondary})` }}
      >
        <h1 className="text-3xl font-bold" style={{ color: colors.brandDark }}>
          News Half-Life
        </h1>
        <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
          {t("newshalflife.subtitle", {
            defaultValue: "Estimate how quickly each news item loses impact on price.",
          })}
        </p>
      </header>

      <form onSubmit={onSubmit} className="rounded-2xl border p-4 shadow-[0_12px_30px_rgba(168,85,247,0.08)] glass-section">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={symbol}
            onChange={(event) => setSymbol(event.target.value.toUpperCase())}
            placeholder={t("newshalflife.symbolPlaceholder", { defaultValue: "Enter symbol (e.g. AAPL)" })}
            className="w-full rounded-xl border px-3 py-2 outline-none"
            style={{ borderColor: colors.borderStrong, backgroundColor: colors.bgSecondary, color: colors.textPrimary }}
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl px-4 py-2 font-semibold text-white disabled:opacity-60"
            style={{ background: `linear-gradient(120deg, ${colors.brandDark}, ${colors.brandMedium})` }}
          >
            {loading ? t("common.loading", { defaultValue: "Loading..." }) : t("newshalflife.searchButton", { defaultValue: "Analyze news" })}
          </button>
        </div>
      </form>

      {error ? (
        <div className="rounded-lg border p-3 text-sm" style={{ borderColor: `${colors.negative}66`, color: colors.negative, backgroundColor: `${colors.negative}14` }}>
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => {
          const active = filter === activeFilter;
          return (
            <button
              key={filter}
              type="button"
              onClick={() => setActiveFilter(filter)}
              className="rounded-full border px-3 py-1.5 text-xs font-semibold transition"
              style={{
                borderColor: active ? colors.brandDark : colors.borderStrong,
                backgroundColor: active ? colors.brandDark : colors.bgPrimary,
                color: active ? colors.bgPrimary : colors.textSecondary,
              }}
            >
              {filter}
            </button>
          );
        })}
      </div>

      {data && filteredNews.length === 0 ? (
        <p style={{ color: colors.textMuted }}>
          {t("newshalflife.empty", { defaultValue: "No recent news found for this symbol." })}
        </p>
      ) : null}

      <section className="space-y-4">
        {filteredNews.map((item, idx) => {
          const longLife = isLongHalfLife(item.halfLifeDays);
          return (
            <article key={`${item.headline}-${idx}`} className="rounded-2xl border p-4 shadow-[0_10px_24px_rgba(168,85,247,0.07)] glass-section">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span
                  className="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
                  style={{ backgroundColor: `${colors.brandDark}16`, color: colors.brandDark }}
                >
                  {data?.symbol}
                </span>
                <span
                  className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                  style={{
                    backgroundColor: longLife ? `${colors.brandGold}29` : colors.bgSecondary,
                    color: longLife ? colors.brandGold : colors.textMuted,
                  }}
                >
                  {halfLifeLabel(item.halfLifeDays, t)}
                </span>
              </div>

              <h3 className="text-base font-semibold" style={{ color: colors.textPrimary }}>
                {item.headline}
              </h3>

              <p className="mt-2 text-xs" style={{ color: colors.textSecondary }}>
                {t("newshalflife.sourceDateLine", {
                  defaultValue: "Source: {{source}} · Date: {{date}}",
                  source: readSource(item),
                  date: formatDate(item.date, i18n.language || "en"),
                })}
              </p>
            </article>
          );
        })}
      </section>
    </div>
  );
}
