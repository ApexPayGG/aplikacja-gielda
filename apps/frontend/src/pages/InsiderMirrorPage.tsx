import { FormEvent, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getInsiderMirror, type InsiderMirrorResponse, type InsiderTransaction } from "../services/api";
import {
  TERMINAL_BUTTON_PRIMARY,
  TERMINAL_DANGER_PANEL,
  TERMINAL_DATA_TABLE,
  TERMINAL_FILTER_CHIP,
  TERMINAL_FILTER_CHIP_ACTIVE,
  TERMINAL_INPUT,
  TERMINAL_INTELLIGENCE_CARD,
  TERMINAL_INTELLIGENCE_GRID,
  TERMINAL_INTELLIGENCE_PAGE,
  TERMINAL_INTELLIGENCE_PAGE_INNER,
  TERMINAL_INTELLIGENCE_PANEL,
  TERMINAL_PAGE_SUBTITLE,
  TERMINAL_PAGE_TITLE,
  TERMINAL_PREDICTOR_PANEL,
  TERMINAL_TABLE_HEAD,
  TERMINAL_TABLE_ROW,
} from "../components/terminal/terminalStyles";
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

function sentimentBadgeClass(sentiment: InsiderMirrorResponse["netSentiment"] | undefined): string {
  if (sentiment === "BUY") {
    return "inline-flex rounded-full border border-terminal-positive/40 bg-terminal-positive/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-terminal-positive";
  }
  if (sentiment === "SELL") {
    return "inline-flex rounded-full border border-terminal-negative/40 bg-terminal-negative/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-terminal-negative";
  }
  return "inline-flex rounded-full border border-terminal-borderMuted bg-terminal-panelSecondary px-3 py-1 text-xs font-semibold uppercase tracking-wide text-terminal-textSecondary";
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

  return (
    <div className={TERMINAL_INTELLIGENCE_PAGE}>
      <div className={TERMINAL_INTELLIGENCE_PAGE_INNER}>
        <header className="space-y-2">
          <h1 className={TERMINAL_PAGE_TITLE}>{t("insider.redesignTitle", { defaultValue: "Insider Mirror" })}</h1>
          <p className={TERMINAL_PAGE_SUBTITLE}>
            {t("insider.redesignSubtitle", {
              defaultValue: "Track recent insider transactions and assess their directional bias.",
            })}
          </p>
        </header>

        <section className={TERMINAL_PREDICTOR_PANEL}>
          <form onSubmit={onSubmit} className="flex flex-col gap-3 md:flex-row">
            <input
              value={symbolInput}
              onChange={(event) => setSymbolInput(event.target.value.toUpperCase())}
              placeholder={t("insider.searchPlaceholder", { defaultValue: "AAPL / MSFT / TSLA" })}
              className={TERMINAL_INPUT}
              maxLength={16}
            />
            <button type="submit" disabled={loading} className={TERMINAL_BUTTON_PRIMARY}>
              {loading
                ? t("common.loading", { defaultValue: "Loading..." })
                : t("insider.fetchTransactions", { defaultValue: "Fetch transactions" })}
            </button>
          </form>
        </section>

        {error ? <div className={TERMINAL_DANGER_PANEL}>{error}</div> : null}

        {!loading && !error && result ? (
          <section className="space-y-6">
            <div className={TERMINAL_INTELLIGENCE_PANEL}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-2xl font-semibold text-terminal-cyan">{result.symbol}</h2>
                <p className="text-sm text-terminal-textSecondary">{result.insight}</p>
              </div>
              <span className={`mt-3 ${sentimentBadgeClass(result.netSentiment)}`}>{sentimentLabel}</span>

              <div className="mt-4 flex flex-wrap gap-2">
                {filterOptions.map((filter) => {
                  const active = activeFilter === filter.value;
                  return (
                    <button
                      key={filter.value}
                      type="button"
                      onClick={() => setActiveFilter(filter.value)}
                      className={active ? TERMINAL_FILTER_CHIP_ACTIVE : TERMINAL_FILTER_CHIP}
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={TERMINAL_INTELLIGENCE_PANEL}>
              <h3 className="text-lg font-semibold text-terminal-cyan">
                {t("insider.transactionsTitle", { defaultValue: "Transactions (last 30 days, > $50k)" })}
              </h3>

              {filteredTransactions.length === 0 ? (
                <p className="mt-3 text-sm text-terminal-textSecondary">
                  {t("insider.emptyTransactions", { defaultValue: "No transactions for the selected filter." })}
                </p>
              ) : (
                <div className={`mt-3 overflow-x-auto ${TERMINAL_DATA_TABLE}`}>
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className={TERMINAL_TABLE_HEAD}>
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
                          <tr key={`${transaction.name}-${transaction.date}-${index}`} className={TERMINAL_TABLE_ROW}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-terminal-cyan/15 text-xs font-bold text-terminal-cyan">
                                  {result.symbol.slice(0, 2)}
                                </span>
                                <span className="font-semibold text-terminal-cyan">{result.symbol}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-semibold text-terminal-text">{transaction.name}</p>
                              <p className="text-xs text-terminal-textSecondary">{transaction.role}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase ${
                                  isPurchase
                                    ? "border border-terminal-positive/40 bg-terminal-positive/10 text-terminal-positive"
                                    : "border border-terminal-negative/40 bg-terminal-negative/10 text-terminal-negative"
                                }`}
                              >
                                {isPurchase
                                  ? t("insider.insiderBuyShort", { defaultValue: "Buy" })
                                  : t("insider.insiderSellShort", { defaultValue: "Sell" })}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-terminal-text">{formatUsd(transaction.value)}</td>
                            <td className="px-4 py-3 text-terminal-textSecondary">{transaction.date}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className={TERMINAL_INTELLIGENCE_PANEL}>
              <h3 className="text-lg font-semibold text-terminal-cyan">
                {t("insider.topInsiders", { defaultValue: "Top insiders" })}
              </h3>
              {topInsiders.length === 0 ? (
                <p className="mt-3 text-sm text-terminal-textSecondary">
                  {t("insider.emptyTopInsiders", { defaultValue: "No data available for Top insiders." })}
                </p>
              ) : (
                <div className={`mt-4 ${TERMINAL_INTELLIGENCE_GRID}`}>
                  {topInsiders.map((insider) => (
                    <article key={insider.name} className={TERMINAL_INTELLIGENCE_CARD}>
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-terminal-cyan/15 text-sm font-bold text-terminal-cyan">
                          {initialsFromName(insider.name)}
                        </span>
                        <div>
                          <p className="font-semibold text-terminal-text">{insider.name}</p>
                          <p className="text-xs text-terminal-textSecondary">{insider.role}</p>
                        </div>
                      </div>
                      <p className="mt-3 text-sm text-terminal-textSecondary">
                        {t("insider.totalValueLabel", {
                          defaultValue: "Total value: {{value}}",
                          value: formatUsd(insider.totalValue),
                        })}
                      </p>
                      <p className="mt-1 text-xs text-terminal-textSecondary">
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
