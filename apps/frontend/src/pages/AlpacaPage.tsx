import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BrokerCTAButton } from "../components/affiliate/BrokerCTAButton";
import { CompanySearchAutocomplete } from "../components/CompanySearchAutocomplete";
import {
  cancelAlpacaOrder,
  getAlpacaAccount,
  getAlpacaOrders,
  getAlpacaPositions,
  placeAlpacaOrder,
  type AlpacaOrderSide,
  type AlpacaOrderType,
} from "../services/api";
import { colors } from "../styles/designSystem";
import { apiErrorMessage } from "../utils/apiErrorMessage";

type AlpacaMode = "paper" | "live";
type GenericRecord = Record<string, unknown>;

interface PositionRow {
  symbol: string;
  qty: number;
  avgPrice: number;
  currentPrice: number;
  pnlPct: number;
}

interface OrderRow {
  id: string;
  symbol: string;
  qty: number;
  side: string;
  type: string;
  status: string;
}

function readUserId(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("userId")?.trim() || "";
}

function asNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function statusStyle(status: string): { backgroundColor: string; color: string; borderColor: string } {
  if (status === "filled") return { backgroundColor: `${colors.positive}14`, color: colors.positive, borderColor: `${colors.positive}55` };
  if (status === "canceled" || status === "rejected") {
    return { backgroundColor: `${colors.negative}14`, color: colors.negative, borderColor: `${colors.negative}55` };
  }
  return { backgroundColor: `${colors.brandGold}18`, color: colors.brandDark, borderColor: `${colors.brandGold}77` };
}

export function AlpacaPage() {
  const { t } = useTranslation();
  const [userId] = useState(() => readUserId());
  const [mode, setMode] = useState<AlpacaMode>("paper");
  const [account, setAccount] = useState<GenericRecord | null>(null);
  const [positions, setPositions] = useState<GenericRecord[]>([]);
  const [orders, setOrders] = useState<GenericRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  const [symbol, setSymbol] = useState("AAPL");
  const [side, setSide] = useState<AlpacaOrderSide>("buy");
  const [qty, setQty] = useState(1);
  const [orderType, setOrderType] = useState<AlpacaOrderType>("market");
  const [limitPrice, setLimitPrice] = useState<number>(0);

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    setNotConfigured(false);
    try {
      const [accountRes, positionsRes, ordersRes] = await Promise.all([
        getAlpacaAccount(userId),
        getAlpacaPositions(userId),
        getAlpacaOrders(userId),
      ]);
      setAccount(accountRes.account ?? null);
      setMode(accountRes.mode);
      setPositions(positionsRes.positions ?? []);
      setOrders((ordersRes.orders ?? []).slice(0, 10));
    } catch (err) {
      const message = apiErrorMessage(err);
      setError(message);
      if (message.toLowerCase().includes("alpaca not configured")) setNotConfigured(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  const normalizedPositions = useMemo<PositionRow[]>(
    () =>
      positions.map((position) => ({
        symbol: String(position.symbol ?? "-"),
        qty: asNumber(position.qty),
        avgPrice: asNumber(position.avg_entry_price),
        currentPrice: asNumber(position.current_price),
        pnlPct: asNumber(position.unrealized_plpc) * 100,
      })),
    [positions],
  );

  const normalizedOrders = useMemo<OrderRow[]>(
    () =>
      orders.map((order) => ({
        id: String(order.id ?? ""),
        symbol: String(order.symbol ?? "-"),
        qty: asNumber(order.qty),
        side: String(order.side ?? "-"),
        type: String(order.type ?? "-"),
        status: String(order.status ?? "unknown"),
      })),
    [orders],
  );

  const portfolioValue = asNumber(account?.portfolio_value ?? account?.equity);
  const buyingPower = asNumber(account?.buying_power);
  const dayPnlPct = useMemo(() => {
    const changeTodayRaw = Number(account?.change_today);
    if (Number.isFinite(changeTodayRaw) && changeTodayRaw !== 0) {
      return Math.abs(changeTodayRaw) > 1 ? changeTodayRaw : changeTodayRaw * 100;
    }
    const equity = asNumber(account?.equity);
    const lastEquity = asNumber(account?.last_equity);
    if (lastEquity <= 0) return 0;
    return ((equity - lastEquity) / lastEquity) * 100;
  }, [account]);

  const isConnected = Boolean(account) && !notConfigured && !error;

  async function handlePlaceOrder(): Promise<void> {
    setError(null);
    const trimmedSymbol = symbol.trim().toUpperCase();
    if (!trimmedSymbol) {
      setError(t("alpaca.symbolRequired", { defaultValue: "Symbol is required." }));
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setError(t("alpaca.qtyRequired", { defaultValue: "Quantity must be greater than 0." }));
      return;
    }
    if (orderType === "limit" && (!Number.isFinite(limitPrice) || limitPrice <= 0)) {
      setError(t("alpaca.limitPriceRequired", { defaultValue: "Limit price must be greater than 0." }));
      return;
    }

    setPlacing(true);
    try {
      await placeAlpacaOrder({
        userId,
        symbol: trimmedSymbol,
        qty,
        side,
        type: orderType,
        limitPrice: orderType === "limit" ? limitPrice : undefined,
      });
      await loadAll();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setPlacing(false);
    }
  }

  async function handleCancelOrder(orderId: string): Promise<void> {
    try {
      await cancelAlpacaOrder(userId, orderId);
      await loadAll();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-10" style={{ color: colors.textPrimary }}>
      <section
        className="rounded-3xl border p-6 shadow-[0_16px_36px_rgba(45,10,107,0.08)]"
        style={{ borderColor: colors.border, background: `linear-gradient(130deg, ${colors.bgPrimary}, ${colors.bgSecondary})` }}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: colors.brandDark }}>
              Alpaca Trading
            </h1>
            <p className="mt-1 text-sm font-medium" style={{ color: colors.textSecondary }}>
              Real trading na rynku US
            </p>
          </div>
          <span
            className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold"
            style={{
              borderColor: isConnected ? `${colors.positive}66` : `${colors.negative}66`,
              color: isConnected ? colors.positive : colors.negative,
              backgroundColor: isConnected ? `${colors.positive}14` : `${colors.negative}14`,
            }}
          >
            {isConnected ? "CONNECTED" : "DISCONNECTED"}
          </span>
        </div>

        <div className="mt-5 inline-flex rounded-xl border p-1" style={{ borderColor: colors.borderStrong, backgroundColor: colors.bgPrimary }}>
          {(["paper", "live"] as const).map((value) => {
            const active = mode === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className="rounded-lg px-4 py-2 text-sm font-semibold transition"
                style={{
                  color: active ? colors.bgPrimary : colors.textSecondary,
                  backgroundColor: active ? colors.brandDark : "transparent",
                }}
              >
                {value === "paper" ? "Paper" : "Live"}
              </button>
            );
          })}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <article className="rounded-2xl border p-4" style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary }}>
            <p className="text-xs uppercase tracking-wide" style={{ color: colors.textMuted }}>
              Portfolio value
            </p>
            <p className="mt-2 font-mono text-2xl font-bold" style={{ color: colors.brandDark }}>
              {loading ? "..." : formatCurrency(portfolioValue)}
            </p>
          </article>
          <article className="rounded-2xl border p-4" style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary }}>
            <p className="text-xs uppercase tracking-wide" style={{ color: colors.textMuted }}>
              Buying power
            </p>
            <p className="mt-2 font-mono text-2xl font-semibold" style={{ color: colors.textPrimary }}>
              {loading ? "..." : formatCurrency(buyingPower)}
            </p>
          </article>
          <article className="rounded-2xl border p-4" style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary }}>
            <p className="text-xs uppercase tracking-wide" style={{ color: colors.textMuted }}>
              Day P&L
            </p>
            <span
              className="mt-2 inline-flex rounded-full border px-3 py-1.5 text-sm font-semibold"
              style={{
                borderColor: dayPnlPct >= 0 ? `${colors.positive}66` : `${colors.negative}66`,
                color: dayPnlPct >= 0 ? colors.positive : colors.negative,
                backgroundColor: dayPnlPct >= 0 ? `${colors.positive}14` : `${colors.negative}14`,
              }}
            >
              {loading ? "..." : formatPercent(dayPnlPct)}
            </span>
          </article>
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border px-4 py-3 text-sm font-medium" style={{ borderColor: `${colors.negative}66`, color: colors.negative, backgroundColor: `${colors.negative}14` }}>
          {error}
        </div>
      ) : null}
      {notConfigured ? (
        <div className="rounded-2xl border p-4" style={{ borderColor: `${colors.brandGold}66`, color: colors.brandDark, backgroundColor: `${colors.brandGold}14` }}>
          <p className="text-sm font-medium">{t("alpaca.connectBanner", { defaultValue: "Connect your Alpaca account in Settings" })}</p>
          <BrokerCTAButton
            sourcePage="alpaca_dashboard"
            brokerSlug="etoro"
            label={t("etoro.alpaca.button", { defaultValue: "Try eToro" })}
            size="small"
            variant="primary"
            showDisclosure={false}
            className="mt-3"
          />
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-6">
          <article className="rounded-2xl border bg-bgPrimary p-5 shadow-[0_12px_28px_rgba(45,10,107,0.08)]" style={{ borderColor: colors.border }}>
            <h2 className="mb-4 text-lg font-semibold" style={{ color: colors.brandDark }}>
              Pozycje
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead style={{ color: colors.textMuted }}>
                  <tr className="border-b" style={{ borderColor: colors.border }}>
                    <th className="px-2 py-2">Symbol</th>
                    <th className="px-2 py-2">Qty</th>
                    <th className="px-2 py-2">Avg Price</th>
                    <th className="px-2 py-2">Current</th>
                    <th className="px-2 py-2">P&amp;L %</th>
                    <th className="px-2 py-2">Akcje</th>
                  </tr>
                </thead>
                <tbody>
                  {normalizedPositions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-2 py-4" style={{ color: colors.textSecondary }}>
                        {loading ? t("common.loading") : t("alpaca.noPositions", { defaultValue: "No open positions" })}
                      </td>
                    </tr>
                  ) : (
                    normalizedPositions.map((position) => (
                      <tr key={position.symbol} className="border-b" style={{ borderColor: colors.border }}>
                        <td className="px-2 py-2 font-semibold" style={{ color: colors.brandDark }}>
                          {position.symbol}
                        </td>
                        <td className="px-2 py-2">{position.qty}</td>
                        <td className="px-2 py-2">{formatCurrency(position.avgPrice)}</td>
                        <td className="px-2 py-2">{formatCurrency(position.currentPrice)}</td>
                        <td className="px-2 py-2">
                          <span className="font-semibold" style={{ color: position.pnlPct >= 0 ? colors.positive : colors.negative }}>
                            {formatPercent(position.pnlPct)}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            className="rounded-lg px-3 py-1 text-xs font-semibold transition"
                            style={{ backgroundColor: `${colors.negative}14`, color: colors.negative }}
                            onClick={() => {
                              setSymbol(position.symbol);
                              setQty(Math.max(1, Math.trunc(position.qty)));
                              setSide("sell");
                            }}
                          >
                            Sprzedaj
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article className="rounded-2xl border bg-bgPrimary p-5 shadow-[0_12px_28px_rgba(45,10,107,0.08)]" style={{ borderColor: colors.border }}>
            <h2 className="mb-4 text-lg font-semibold" style={{ color: colors.brandDark }}>
              Recent orders
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead style={{ color: colors.textMuted }}>
                  <tr className="border-b" style={{ borderColor: colors.border }}>
                    <th className="px-2 py-2">Symbol</th>
                    <th className="px-2 py-2">Qty</th>
                    <th className="px-2 py-2">Side</th>
                    <th className="px-2 py-2">Type</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Akcje</th>
                  </tr>
                </thead>
                <tbody>
                  {normalizedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-2 py-4" style={{ color: colors.textSecondary }}>
                        {loading ? t("common.loading") : t("alpaca.noOrders", { defaultValue: "No recent orders" })}
                      </td>
                    </tr>
                  ) : (
                    normalizedOrders.map((order) => {
                      const canCancel = order.status !== "filled" && order.status !== "canceled";
                      return (
                        <tr key={order.id} className="border-b" style={{ borderColor: colors.border }}>
                          <td className="px-2 py-2 font-semibold" style={{ color: colors.brandDark }}>
                            {order.symbol}
                          </td>
                          <td className="px-2 py-2">{order.qty}</td>
                          <td className="px-2 py-2 uppercase">{order.side}</td>
                          <td className="px-2 py-2 uppercase">{order.type}</td>
                          <td className="px-2 py-2">
                            <span className="rounded-full border px-2 py-0.5 text-xs font-semibold uppercase" style={statusStyle(order.status)}>
                              {order.status}
                            </span>
                          </td>
                          <td className="px-2 py-2">
                            {canCancel ? (
                              <button
                                type="button"
                                className="text-xs font-semibold transition hover:opacity-80"
                                style={{ color: colors.negative }}
                                onClick={() => void handleCancelOrder(order.id)}
                              >
                                Cancel
                              </button>
                            ) : (
                              <span className="text-xs" style={{ color: colors.textMuted }}>
                                -
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </div>

        <aside className="rounded-2xl border bg-bgPrimary p-5 shadow-[0_12px_28px_rgba(45,10,107,0.08)] lg:sticky lg:top-20 lg:h-fit" style={{ borderColor: colors.border }}>
          <h2 className="text-lg font-semibold" style={{ color: colors.brandDark }}>
            Order form
          </h2>
          <div className="mt-4 space-y-4">
            <div>
              <p className="mb-1 text-sm font-medium" style={{ color: colors.textSecondary }}>
                Symbol search
              </p>
              <CompanySearchAutocomplete
                initialValue={symbol}
                limit={8}
                navigateOnSelect={false}
                placeholder="AAPL"
                onQueryChange={(nextQuery) => setSymbol(nextQuery.toUpperCase())}
                onSelectCompany={(company) => setSymbol(company.symbol.toUpperCase())}
              />
            </div>

            <div>
              <p className="mb-1 text-sm font-medium" style={{ color: colors.textSecondary }}>
                Side
              </p>
              <div className="grid grid-cols-2 gap-2 rounded-xl border p-1" style={{ borderColor: colors.borderStrong, backgroundColor: colors.bgPrimary }}>
                <button
                  type="button"
                  className="rounded-lg px-3 py-2 text-sm font-semibold transition"
                  style={{
                    backgroundColor: side === "buy" ? `${colors.positive}22` : "transparent",
                    color: side === "buy" ? colors.positive : colors.textSecondary,
                  }}
                  onClick={() => setSide("buy")}
                >
                  Buy
                </button>
                <button
                  type="button"
                  className="rounded-lg px-3 py-2 text-sm font-semibold transition"
                  style={{
                    backgroundColor: side === "sell" ? `${colors.negative}22` : "transparent",
                    color: side === "sell" ? colors.negative : colors.textSecondary,
                  }}
                  onClick={() => setSide("sell")}
                >
                  Sell
                </button>
              </div>
            </div>

            <label className="block text-sm font-medium" style={{ color: colors.textSecondary }}>
              Qty
              <input
                type="number"
                min={1}
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
                style={{ borderColor: colors.borderStrong, backgroundColor: colors.bgSecondary, color: colors.textPrimary }}
                value={qty}
                onChange={(event) => setQty(Math.max(1, Math.trunc(Number(event.target.value) || 1)))}
              />
            </label>

            <label className="block text-sm font-medium" style={{ color: colors.textSecondary }}>
              Order type
              <select
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
                style={{ borderColor: colors.borderStrong, backgroundColor: colors.bgSecondary, color: colors.textPrimary }}
                value={orderType}
                onChange={(event) => setOrderType(event.target.value as AlpacaOrderType)}
              >
                <option value="market">Market</option>
                <option value="limit">Limit</option>
              </select>
            </label>

            {orderType === "limit" ? (
              <label className="block text-sm font-medium" style={{ color: colors.textSecondary }}>
                Limit price
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
                  style={{ borderColor: colors.borderStrong, backgroundColor: colors.bgSecondary, color: colors.textPrimary }}
                  value={Number.isFinite(limitPrice) ? limitPrice : 0}
                  onChange={(event) => setLimitPrice(Math.max(0, Number(event.target.value) || 0))}
                />
              </label>
            ) : null}

            <button
              type="button"
              className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-65"
              style={{ backgroundColor: colors.brandDark }}
              disabled={placing}
              onClick={() => void handlePlaceOrder()}
            >
              {placing ? t("common.loading") : "Złóż zlecenie"}
            </button>
          </div>
        </aside>
      </section>
    </div>
  );
}
