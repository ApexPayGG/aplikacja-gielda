import { FormEvent, useMemo, useState } from "react";
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
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
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
  const [symbolInput, setSymbolInput] = useState("AAPL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InsiderMirrorResponse | null>(null);
  const [activeFilter, setActiveFilter] = useState<TransactionFilter>("ALL");

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const symbol = symbolInput.trim().toUpperCase();
    if (!symbol) {
      setError("Podaj symbol spółki.");
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

  return (
    <div className="min-h-screen py-8" style={{ backgroundColor: colors.bgSecondary }}>
      <div className="mx-auto max-w-6xl px-4">
        <header className="mb-8">
          <h1 className="text-4xl font-bold" style={{ color: colors.brandDark }}>
            Insider Mirror
          </h1>
          <p className="mt-2 text-sm md:text-base" style={{ color: colors.textSecondary }}>
            Śledź najnowsze transakcje insiderów i szybko oceniaj kierunek ich działania.
          </p>
        </header>

        <section className="rounded-2xl border p-5" style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary }}>
          <form onSubmit={onSubmit} className="flex flex-col gap-3 md:flex-row">
            <input
              value={symbolInput}
              onChange={(event) => setSymbolInput(event.target.value.toUpperCase())}
              placeholder="AAPL / MSFT / TSLA"
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
              {loading ? "Ładowanie..." : "Pobierz transakcje"}
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
            <div className="rounded-2xl border p-5" style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-2xl font-semibold" style={{ color: colors.brandDark }}>
                  {result.symbol}
                </h2>
                <p className="text-sm" style={{ color: colors.textSecondary }}>
                  {result.insight}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {FILTER_OPTIONS.map((filter) => {
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

            <div className="rounded-2xl border p-5" style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary }}>
              <h3 className="text-lg font-semibold" style={{ color: colors.brandDark }}>
                Transakcje insiderów
              </h3>

              {filteredTransactions.length === 0 ? (
                <p className="mt-3 text-sm" style={{ color: colors.textSecondary }}>
                  Brak transakcji dla wybranego filtra.
                </p>
              ) : (
                <div className="mt-3 overflow-x-auto rounded-xl border" style={{ borderColor: colors.border }}>
                  <table className="min-w-full text-left text-sm">
                    <thead style={{ backgroundColor: colors.bgSecondary, color: colors.textSecondary }}>
                      <tr>
                        <th className="px-4 py-3 font-semibold">Logo+Symbol</th>
                        <th className="px-4 py-3 font-semibold">Insider</th>
                        <th className="px-4 py-3 font-semibold">Typ (Kup/Sprzedaj)</th>
                        <th className="px-4 py-3 text-right font-semibold">Wartość</th>
                        <th className="px-4 py-3 font-semibold">Data</th>
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
                                {isPurchase ? "Kup" : "Sprzedaj"}
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

            <div className="rounded-2xl border p-5" style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary }}>
              <h3 className="text-lg font-semibold" style={{ color: colors.brandDark }}>
                Top insiders
              </h3>
              {topInsiders.length === 0 ? (
                <p className="mt-3 text-sm" style={{ color: colors.textSecondary }}>
                  Brak danych dla sekcji Top insiders.
                </p>
              ) : (
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {topInsiders.map((insider) => (
                    <article key={insider.name} className="rounded-xl border p-4" style={{ borderColor: colors.border, backgroundColor: colors.bgSecondary }}>
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
                        Łączna wartość: <span style={{ color: colors.brandDark, fontWeight: 700 }}>{formatUsd(insider.totalValue)}</span>
                      </p>
                      <p className="mt-1 text-xs" style={{ color: colors.textSecondary }}>
                        Kup: {insider.purchases} · Sprzedaj: {insider.sales}
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
