import { FormEvent, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getInsiderMirror, type InsiderMirrorResponse, type InsiderTransaction } from "../services/api";
import { colors } from "../styles/designSystem";
import { apiErrorMessage } from "../utils/apiErrorMessage";

type TransactionFilter = "ALL" | "PURCHASES" | "SALES" | "LAST_7_DAYS" | "LAST_30_DAYS";

const FILTER_OPTIONS: Array<{ value: TransactionFilter; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "PURCHASES", label: "Purchases" },
  { value: "SALES", label: "Sales" },
  { value: "LAST_7_DAYS", label: "Last 7 days" },
  { value: "LAST_30_DAYS", label: "Last 30 days" },
];

function parseDateToMs(value: string): number | null {
  const normalized = value.trim();
  const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    const timestamp = Date.UTC(year, month - 1, day, 12, 0, 0, 0);
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  const fallback = new Date(normalized).getTime();
  return Number.isFinite(fallback) ? fallback : null;
}

function isWithinDays(date: string, days: number): boolean {
  const timestamp = parseDateToMs(date);
  if (timestamp === null) return false;
  const now = Date.now();
  const limit = now - days * 24 * 60 * 60 * 1000;
  return timestamp >= limit && timestamp <= now;
}

function formatUsd(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function initialsFromName(name: string): string {
  const parts = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return "IN";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function matchesFilter(transaction: InsiderTransaction, filter: TransactionFilter): boolean {
  if (filter === "ALL") return true;
  if (filter === "PURCHASES") return transaction.action === "BUY";
  if (filter === "SALES") return transaction.action === "SELL";
  if (filter === "LAST_7_DAYS") return isWithinDays(transaction.date, 7);
  return isWithinDays(transaction.date, 30);
}

export function InsiderMirrorPage() {
  const { t } = useTranslation();
  const [symbolInput, setSymbolInput] = useState("AAPL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InsiderMirrorResponse | null>(null);
  const [activeFilter, setActiveFilter] = useState<TransactionFilter>("ALL");
  const filterOptions = useMemo(
    () =>
      FILTER_OPTIONS.map((option) => ({
        value: option.value,
        label: t(`insider.filters.${option.value}`, { defaultValue: option.label }),
      })),
    [t],
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const symbol = symbolInput.trim().toUpperCase();
    if (!symbol) {
      setError(t("insider.validationSymbol", { defaultValue: "Please provide a valid symbol." }));
      setResult(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const next = await getInsiderMirror(symbol);
      setResult(next);
    } catch (e) {
      setResult(null);
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  const filteredTransactions = useMemo(() => {
    if (!result) return [];
    return result.transactions.filter((transaction) => matchesFilter(transaction, activeFilter));
  }, [activeFilter, result]);

  const topInsiders = useMemo(() => {
    const aggregate = new Map<
      string,
      {
        name: string;
        role: string;
        totalValue: number;
        purchases: number;
        sales: number;
      }
    >();

    for (const transaction of filteredTransactions) {
      const existing = aggregate.get(transaction.name) ?? {
        name: transaction.name,
        role: transaction.role,
        totalValue: 0,
        purchases: 0,
        sales: 0,
      };

      existing.totalValue += Math.abs(transaction.value);
      if (transaction.action === "BUY") existing.purchases += 1;
      if (transaction.action === "SELL") existing.sales += 1;
      aggregate.set(transaction.name, existing);
    }

    return [...aggregate.values()].sort((a, b) => b.totalValue - a.totalValue).slice(0, 3);
  }, [filteredTransactions]);
  const sentimentLabel = result
    ? result.netSentiment === "BUY"
      ? t("insider.sentimentBuy", { defaultValue: "Net buying" })
      : result.netSentiment === "SELL"
        ? t("insider.sentimentSell", { defaultValue: "Net selling" })
        : t("insider.sentimentNeutral", { defaultValue: "Neutral" })
    : "";
  const sentimentColor =
    result?.netSentiment === "BUY"
      ? colors.positive
      : result?.netSentiment === "SELL"
        ? colors.negative
        : colors.textSecondary;

  return (
    <div className="min-h-screen py-8" style={{ backgroundColor: colors.bgSecondary }}>
      <div className="mx-auto max-w-6xl px-4">
        <header className="mb-8">
          <h1 className="text-4xl font-bold" style={{ color: colors.brandDark }}>
            {t("insider.redesignTitle", { defaultValue: "Insider Mirror" })}
          </h1>
          <p className="mt-2 text-sm md:text-base" style={{ color: colors.textSecondary }}>
            {t("insider.redesignSubtitle", {
              defaultValue: "Track recent insider transactions and assess their directional bias.",
            })}
          </p>
        </header>

        <section className="rounded-2xl border p-5 glass-section">
          <form onSubmit={onSubmit} className="flex flex-col gap-3 md:flex-row">
            <input
              value={symbolInput}
              onChange={(event) => setSymbolInput(event.target.value.toUpperCase())}
              placeholder={t("insider.searchPlaceholder", { defaultValue: "AAPL / MSFT / TSLA" })}
              className="w-full rounded-xl border px-4 py-2.5 outline-none"
              style={{ borderColor: colors.borderStrong, backgroundColor: colors.bgSecondary, color: colors.textPrimary }}
              maxLength={16}
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl px-5 py-2.5 font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: colors.brandDark }}
            >
              {loading
                ? t("common.loading", { defaultValue: "Loading..." })
                : t("insider.fetchTransactions", { defaultValue: "Fetch transactions" })}
            </button>
          </form>
        </section>

        {error ? (
          <div
            className="mt-4 rounded-xl border px-4 py-3 text-sm"
            style={{
              borderColor: `${colors.negative}66`,
              color: colors.negative,
              backgroundColor: `${colors.negative}12`,
            }}
          >
            {error}
          </div>
        ) : null}

        {!loading && !error && result ? (
          <section className="mt-6 space-y-6">
            <div className="rounded-2xl border p-5 glass-section">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-2xl font-semibold" style={{ color: colors.brandDark }}>
                  {result.symbol}
                </h2>
                <p className="text-sm" style={{ color: colors.textSecondary }}>
                  {result.insight}
                </p>
              </div>
              <span
                className="mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
                style={{ backgroundColor: `${sentimentColor}1A`, color: sentimentColor }}
              >
                {sentimentLabel}
              </span>

              <div className="mt-4 flex flex-wrap gap-2">
                {filterOptions.map((filter) => {
                  const active = activeFilter === filter.value;
                  return (
                    <button
                      key={filter.value}
                      type="button"
                      onClick={() => setActiveFilter(filter.value)}
                      className="rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
                      style={{
                        backgroundColor: active ? colors.brandDark : colors.bgSecondary,
                        color: active ? colors.bgPrimary : colors.textSecondary,
                        border: `1px solid ${active ? colors.brandDark : colors.border}`,
                      }}
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border p-5 glass-section">
              <h3 className="text-lg font-semibold" style={{ color: colors.brandDark }}>
                {t("insider.transactionsTitle", { defaultValue: "Transactions (last 30 days, > $50k)" })}
              </h3>

              {filteredTransactions.length === 0 ? (
                <p className="mt-3 text-sm" style={{ color: colors.textSecondary }}>
                  {t("insider.emptyTransactions", { defaultValue: "No transactions for the selected filter." })}
                </p>
              ) : (
                <div className="mt-3 overflow-x-auto rounded-xl border" style={{ borderColor: colors.border }}>
                  <table className="min-w-full text-left text-sm">
                    <thead style={{ backgroundColor: colors.bgSecondary, color: colors.textSecondary }}>
                      <tr>
                        <th className="px-4 py-3 font-semibold">{t("insider.colLogoSymbol", { defaultValue: "Logo & symbol" })}</th>
                        <th className="px-4 py-3 font-semibold">{t("insider.colName", { defaultValue: "Name" })}</th>
                        <th className="px-4 py-3 font-semibold">{t("insider.colType", { defaultValue: "Side (buy/sell)" })}</th>
                        <th className="px-4 py-3 text-right font-semibold">{t("insider.colValue", { defaultValue: "Value" })}</th>
                        <th className="px-4 py-3 font-semibold">{t("insider.colDate", { defaultValue: "Date" })}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransactions.map((transaction, index) => {
                        const isPurchase = transaction.action === "BUY";
                        return (
                          <tr key={`${transaction.name}-${transaction.date}-${index}`} className="border-t" style={{ borderColor: colors.border }}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
                                  style={{ backgroundColor: colors.brandDark, color: colors.bgPrimary }}
                                >
                                  {result.symbol.slice(0, 2)}
                                </span>
                                <span className="font-semibold" style={{ color: colors.brandDark }}>
                                  {result.symbol}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-semibold" style={{ color: colors.textPrimary }}>
                                {transaction.name}
                              </p>
                              <p className="text-xs" style={{ color: colors.textSecondary }}>
                                {transaction.role}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className="inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase"
                                style={{
                                  backgroundColor: isPurchase ? `${colors.positive}1A` : `${colors.negative}1A`,
                                  color: isPurchase ? colors.positive : colors.negative,
                                }}
                              >
                                {isPurchase
                                  ? t("insider.insiderBuyShort", { defaultValue: "Buy" })
                                  : t("insider.insiderSellShort", { defaultValue: "Sell" })}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-mono" style={{ color: colors.textPrimary }}>
                              {formatUsd(transaction.value)}
                            </td>
                            <td className="px-4 py-3" style={{ color: colors.textSecondary }}>
                              {transaction.date}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded-2xl border p-5 glass-section">
              <h3 className="text-lg font-semibold" style={{ color: colors.brandDark }}>
                {t("insider.topInsiders", { defaultValue: "Top insiders" })}
              </h3>
              {topInsiders.length === 0 ? (
                <p className="mt-3 text-sm" style={{ color: colors.textSecondary }}>
                  {t("insider.emptyTopInsiders", { defaultValue: "No data available for Top insiders." })}
                </p>
              ) : (
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {topInsiders.map((insider) => (
                    <article key={insider.name} className="rounded-xl border p-4 glass-panel">
                      <div className="flex items-center gap-3">
                        <span
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold"
                          style={{ backgroundColor: colors.brandDark, color: colors.bgPrimary }}
                        >
                          {initialsFromName(insider.name)}
                        </span>
                        <div>
                          <p className="font-semibold" style={{ color: colors.textPrimary }}>
                            {insider.name}
                          </p>
                          <p className="text-xs" style={{ color: colors.textSecondary }}>
                            {insider.role}
                          </p>
                        </div>
                      </div>
                      <p className="mt-3 text-sm" style={{ color: colors.textSecondary }}>
                        {t("insider.totalValueLabel", {
                          defaultValue: "Total value: {{value}}",
                          value: formatUsd(insider.totalValue),
                        })}
                      </p>
                      <p className="mt-1 text-xs" style={{ color: colors.textSecondary }}>
                        {t("insider.countsBuySell", {
                          defaultValue: "Buys: {{buys}} · Sells: {{sells}}",
                          buys: insider.purchases,
                          sells: insider.sales,
                        })}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
