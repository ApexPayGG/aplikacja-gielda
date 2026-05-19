import axios from "axios";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getCompanyDividendTickerHistory, getDividendHealth, type DividendHealthData } from "../services/api";
import { colors } from "../styles/designSystem";
import { apiErrorMessage } from "../utils/apiErrorMessage";

type Props = {
  symbol: string;
  locale: string;
  companyName?: string | null;
};

function isDividendNotFoundError(e: unknown): boolean {
  if (axios.isAxiosError(e)) {
    if (e.response?.status === 404) return true;
    const body = e.response?.data;
    if (body && typeof body === "object" && "error" in body) {
      const apiErr = String((body as { error: unknown }).error).toLowerCase();
      if (apiErr.includes("dividend data not found")) return true;
    }
  }
  return apiErrorMessage(e).toLowerCase().includes("dividend data not found");
}

function healthColor(score: number): string {
  if (score > 70) return colors.positive;
  if (score >= 40) return colors.brandGold;
  return colors.negative;
}

function labelBadgeStyle(label: DividendHealthData["healthLabel"]): { bg: string; color: string } {
  if (label === "SAFE") return { bg: "rgba(0, 168, 107, 0.14)", color: colors.positive };
  if (label === "WATCH") return { bg: "rgba(245, 158, 11, 0.16)", color: colors.brandGold };
  return { bg: "rgba(229, 57, 53, 0.14)", color: colors.negative };
}

export function CompanyDividendPanel({ symbol, locale, companyName }: Props) {
  const { t } = useTranslation("common");
  const [health, setHealth] = useState<DividendHealthData | null>(null);
  const [history, setHistory] = useState<
    Array<{ exDate: string; payDate: string; amount: number; yield: number | null }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noDividend, setNoDividend] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setNoDividend(false);
      try {
        const [healthData, historyResponse] = await Promise.all([
          getDividendHealth(symbol),
          getCompanyDividendTickerHistory(symbol, 8),
        ]);
        if (!cancelled) {
          setHealth(healthData);
          setHistory(
            [...(historyResponse.history ?? [])]
              .map((row) => ({
                exDate: row.ex_date,
                payDate: row.payment_date,
                amount: row.amount,
                yield: row.dy ?? null,
              }))
              .sort((a, b) => new Date(b.exDate).getTime() - new Date(a.exDate).getTime()),
          );
        }
      } catch (e) {
        if (!cancelled) {
          setHealth(null);
          setHistory([]);
          if (isDividendNotFoundError(e)) {
            setNoDividend(true);
            setError(null);
          } else {
            setNoDividend(false);
            setError(apiErrorMessage(e));
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  if (loading) {
    return (
      <p className="text-sm" style={{ color: colors.textSecondary }}>
        {t("common.loading", { defaultValue: "Loading..." })}
      </p>
    );
  }

  if (noDividend) {
    const displayName = companyName?.trim() || symbol;
    return (
      <div
        className="rounded-lg border px-4 py-4"
        style={{ borderColor: colors.border, backgroundColor: colors.bgSecondary }}
      >
        <p className="text-sm font-semibold" style={{ color: colors.textPrimary }}>
          {t("company.dividend.noDividend.title", {
            defaultValue: "📊 Ta spółka nie wypłaca dywidend",
          })}
        </p>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: colors.textSecondary }}>
          {companyName?.trim()
            ? t("company.dividend.noDividend.description", {
                defaultValue: "{{companyName}} to spółka wzrostowa reinwestująca zyski w rozwój.",
                companyName: displayName,
              })
            : t("company.dividend.noDividend.descriptionGeneric", {
                defaultValue: "To spółka wzrostowa reinwestująca zyski w rozwój.",
              })}
        </p>
      </div>
    );
  }

  if (error || !health) {
    return (
      <p className="rounded-lg border px-4 py-3 text-sm" style={{ borderColor: colors.border, color: colors.negative }}>
        {error ??
          t("company.dividend.unavailable", {
            defaultValue: "Dividend data is not available for this symbol.",
          })}
      </p>
    );
  }

  const badge = labelBadgeStyle(health.healthLabel);
  const dateFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
            {t("company.dividend.title", { defaultValue: "Dividend snapshot" })}
          </h2>
          <p className="mt-1 text-sm" style={{ color: colors.textSecondary }}>
            {t("company.dividend.subtitle", {
              defaultValue: "Health score, latest payout, and recent ex-dates.",
            })}
          </p>
        </div>
        <span
          className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
          style={{ backgroundColor: badge.bg, color: badge.color }}
        >
          {health.healthLabel}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span style={{ color: colors.textSecondary }}>
            {t("company.dividend.healthScore", { defaultValue: "Health score" })}
          </span>
          <span className="font-semibold" style={{ color: healthColor(health.healthScore) }}>
            {health.healthScore}/100
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: colors.bgTertiary }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${health.healthScore}%`, backgroundColor: healthColor(health.healthScore) }}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          {
            label: t("company.dividend.yield", { defaultValue: "Dividend yield" }),
            value: `${health.dividendYield.toFixed(2)}%`,
          },
          {
            label: t("company.dividend.payoutRatio", { defaultValue: "Payout ratio" }),
            value: `${health.payoutRatio.toFixed(1)}%`,
          },
          {
            label: t("company.dividend.growthYears", { defaultValue: "Years of growth" }),
            value: String(health.yearsOfGrowth),
          },
          {
            label: t("company.dividend.trend", { defaultValue: "Trend" }),
            value: health.trend,
          },
          {
            label: t("company.dividend.nextExDate", { defaultValue: "Latest ex-date" }),
            value: dateFmt.format(new Date(health.exDate)),
          },
          {
            label: t("company.dividend.amount", { defaultValue: "Amount / share" }),
            value: `${health.amount.toFixed(4)} ${health.currency}`,
          },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-lg border px-3 py-2.5"
            style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary }}
          >
            <p className="text-xs font-medium uppercase tracking-wide" style={{ color: colors.textMuted }}>
              {item.label}
            </p>
            <p className="mt-1 text-sm font-semibold" style={{ color: colors.textPrimary }}>
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {health.aiBreef ? (
        <article
          className="rounded-lg border px-4 py-3 text-sm leading-relaxed"
          style={{ borderColor: colors.border, color: colors.textSecondary, backgroundColor: colors.bgPrimary }}
        >
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: colors.brandDark }}>
            {t("company.dividend.aiBrief", { defaultValue: "AI dividend brief" })}
          </p>
          {health.aiBreef}
        </article>
      ) : null}

      <div>
        <h3 className="text-sm font-semibold" style={{ color: colors.textPrimary }}>
          {t("company.dividend.calendar", { defaultValue: "Payout calendar" })}
        </h3>
        {history.length === 0 ? (
          <p className="mt-2 text-sm" style={{ color: colors.textMuted }}>
            {t("company.dividend.noHistory", { defaultValue: "No dividend history rows yet." })}
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border" style={{ borderColor: colors.border }}>
            <table className="min-w-full text-left text-sm">
              <thead style={{ backgroundColor: colors.bgTertiary }}>
                <tr>
                  <th className="px-4 py-2 font-semibold" style={{ color: colors.textSecondary }}>
                    {t("dividendsPage.exDate", { defaultValue: "Ex-date" })}
                  </th>
                  <th className="px-4 py-2 font-semibold" style={{ color: colors.textSecondary }}>
                    {t("dividendsPage.payDate", { defaultValue: "Pay date" })}
                  </th>
                  <th className="px-4 py-2 font-semibold" style={{ color: colors.textSecondary }}>
                    {t("dividendsPage.amount", { defaultValue: "Amount" })}
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={`${row.exDate}-${row.amount}`} style={{ borderTop: `1px solid ${colors.border}` }}>
                    <td className="px-4 py-2 font-mono text-xs">{dateFmt.format(new Date(row.exDate))}</td>
                    <td className="px-4 py-2 font-mono text-xs">{dateFmt.format(new Date(row.payDate))}</td>
                    <td className="px-4 py-2">
                      {row.amount.toFixed(4)} {health.currency}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
