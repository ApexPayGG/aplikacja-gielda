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
import { StatusPill } from "../components/terminal/StatusPill";
import { TerminalButton } from "../components/terminal/TerminalButton";
import {
  TERMINAL_APP_BG,
  TERMINAL_DANGER_PANEL,
  TERMINAL_FILTER_CHIP,
  TERMINAL_FILTER_CHIP_ACTIVE,
  TERMINAL_FORM_GROUP,
  TERMINAL_FORM_LABEL,
  TERMINAL_INFO_BANNER,
  TERMINAL_INPUT,
  TERMINAL_MODE_SWITCH,
  TERMINAL_PAGE_TITLE,
  TERMINAL_SETTINGS_CARD,
  TERMINAL_SETTINGS_PANEL,
  TERMINAL_STATUS_CARD,
  TERMINAL_TEXT_MUTED,
} from "../components/terminal/terminalStyles";
import { apiErrorMessage } from "../utils/apiErrorMessage";
import { formatCurrency, formatPercent } from "../utils/formatters";

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

function statusBadgeClass(status: string): string {
  if (status === "filled") return "border-terminal-positive/40 bg-terminal-positive/10 text-terminal-positive";
  if (status === "canceled" || status === "rejected") {
    return "border-terminal-negative/40 bg-terminal-negative/10 text-terminal-negative";
  }
  return "border-terminal-warning/40 bg-terminal-warning/10 text-terminal-warning";
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
    <div className={`${TERMINAL_APP_BG} mx-auto max-w-7xl space-y-6 px-4 py-10`}>
      <section className={TERMINAL_SETTINGS_PANEL}>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className={TERMINAL_PAGE_TITLE}>{t("alpaca.title", { defaultValue: "Alpaca Trading" })}</h1>
            <p className={`mt-1 ${TERMINAL_TEXT_MUTED}`}>
              {t("alpaca.subtitleUs", { defaultValue: "Live and paper trading on US markets." })}
            </p>
          </div>
          <StatusPill variant={isConnected ? "live" : "inactive"} showDot>
            {isConnected ? "CONNECTED" : "DISCONNECTED"}
          </StatusPill>
        </div>

        <div className={`mt-5 ${TERMINAL_MODE_SWITCH}`}>
          {(["paper", "live"] as const).map((value) => {
            const active = mode === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={active ? TERMINAL_FILTER_CHIP_ACTIVE : TERMINAL_FILTER_CHIP}
              >
                {value === "paper" ? "Paper" : "Live"}
              </button>
            );
          })}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <article className={TERMINAL_STATUS_CARD}>
            <p className="text-xs uppercase tracking-wide text-terminal-textMuted">Portfolio value</p>
            <p className="mt-2 font-mono text-2xl font-bold text-terminal-cyan">
              {loading ? "..." : formatCurrency(portfolioValue, "USD")}
            </p>
          </article>
          <article className={TERMINAL_STATUS_CARD}>
            <p className="text-xs uppercase tracking-wide text-terminal-textMuted">Buying power</p>
            <p className="mt-2 font-mono text-2xl font-semibold text-terminal-text">
              {loading ? "..." : formatCurrency(buyingPower, "USD")}
            </p>
          </article>
          <article className={TERMINAL_STATUS_CARD}>
            <p className="text-xs uppercase tracking-wide text-terminal-textMuted">Day P&L</p>
            <span
              className={`mt-2 inline-flex rounded-full border px-3 py-1.5 text-sm font-semibold ${
                dayPnlPct >= 0
                  ? "border-terminal-positive/40 bg-terminal-positive/10 text-terminal-positive"
                  : "border-terminal-negative/40 bg-terminal-negative/10 text-terminal-negative"
              }`}
            >
              {loading ? "..." : formatPercent(dayPnlPct)}
            </span>
          </article>
        </div>
      </section>

      {error ? <div className={TERMINAL_DANGER_PANEL}>{error}</div> : null}
      {notConfigured ? (
        <div className={TERMINAL_INFO_BANNER}>
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
          <article className={TERMINAL_SETTINGS_CARD}>
            <h2 className="mb-4 text-lg font-semibold text-terminal-cyan">
              {t("alpaca.positions", { defaultValue: "Positions" })}
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm text-terminal-text">
                <thead className="text-terminal-textMuted">
                  <tr className="border-b border-terminal-border">
                    <th className="px-2 py-2">Symbol</th>
                    <th className="px-2 py-2">Qty</th>
                    <th className="px-2 py-2">Avg Price</th>
                    <th className="px-2 py-2">Current</th>
                    <th className="px-2 py-2">P&amp;L %</th>
                    <th className="px-2 py-2">{t("alpaca.actionsColumn", { defaultValue: "Actions" })}</th>
                  </tr>
                </thead>
                <tbody>
                  {normalizedPositions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-2 py-4 text-terminal-textSecondary">
                        {loading ? t("common.loading") : t("alpaca.noPositions", { defaultValue: "No open positions" })}
                      </td>
                    </tr>
                  ) : (
                    normalizedPositions.map((position) => (
                      <tr key={position.symbol} className="border-b border-terminal-borderMuted">
                        <td className="px-2 py-2 font-semibold text-terminal-cyan">{position.symbol}</td>
                        <td className="px-2 py-2">{position.qty}</td>
                        <td className="px-2 py-2">{formatCurrency(position.avgPrice, "USD")}</td>
                        <td className="px-2 py-2">{formatCurrency(position.currentPrice, "USD")}</td>
                        <td className="px-2 py-2">
                          <span
                            className={`font-semibold ${position.pnlPct >= 0 ? "text-terminal-positive" : "text-terminal-negative"}`}
                          >
                            {formatPercent(position.pnlPct)}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            className="rounded-lg border border-terminal-negative/40 bg-terminal-negative/10 px-3 py-1 text-xs font-semibold text-terminal-negative transition hover:bg-terminal-negative/20"
                            onClick={() => {
                              setSymbol(position.symbol);
                              setQty(Math.max(1, Math.trunc(position.qty)));
                              setSide("sell");
                            }}
                          >
                            {t("alpaca.sell", { defaultValue: "Sell" })}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article className={TERMINAL_SETTINGS_CARD}>
            <h2 className="mb-4 text-lg font-semibold text-terminal-cyan">Recent orders</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm text-terminal-text">
                <thead className="text-terminal-textMuted">
                  <tr className="border-b border-terminal-border">
                    <th className="px-2 py-2">Symbol</th>
                    <th className="px-2 py-2">Qty</th>
                    <th className="px-2 py-2">Side</th>
                    <th className="px-2 py-2">Type</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">{t("alpaca.actionsColumn", { defaultValue: "Actions" })}</th>
                  </tr>
                </thead>
                <tbody>
                  {normalizedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-2 py-4 text-terminal-textSecondary">
                        {loading ? t("common.loading") : t("alpaca.noOrders", { defaultValue: "No recent orders" })}
                      </td>
                    </tr>
                  ) : (
                    normalizedOrders.map((order) => {
                      const canCancel = order.status !== "filled" && order.status !== "canceled";
                      return (
                        <tr key={order.id} className="border-b border-terminal-borderMuted">
                          <td className="px-2 py-2 font-semibold text-terminal-cyan">{order.symbol}</td>
                          <td className="px-2 py-2">{order.qty}</td>
                          <td className="px-2 py-2 uppercase">{order.side}</td>
                          <td className="px-2 py-2 uppercase">{order.type}</td>
                          <td className="px-2 py-2">
                            <span
                              className={`rounded-full border px-2 py-0.5 text-xs font-semibold uppercase ${statusBadgeClass(order.status)}`}
                            >
                              {order.status}
                            </span>
                          </td>
                          <td className="px-2 py-2">
                            {canCancel ? (
                              <button
                                type="button"
                                className="text-xs font-semibold text-terminal-negative transition hover:opacity-80"
                                onClick={() => void handleCancelOrder(order.id)}
                              >
                                Cancel
                              </button>
                            ) : (
                              <span className="text-xs text-terminal-textMuted">-</span>
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

        <aside className={`${TERMINAL_SETTINGS_CARD} lg:sticky lg:top-20 lg:h-fit`}>
          <h2 className="text-lg font-semibold text-terminal-cyan">Order form</h2>
          <div className="mt-4 space-y-4">
            <div>
              <p className={`mb-1 ${TERMINAL_FORM_LABEL}`}>Symbol search</p>
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
              <p className={TERMINAL_FORM_LABEL}>Side</p>
              <div className={`mt-1 grid grid-cols-2 gap-2 ${TERMINAL_MODE_SWITCH}`}>
                <button
                  type="button"
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    side === "buy"
                      ? "bg-terminal-positive/15 text-terminal-positive"
                      : TERMINAL_FILTER_CHIP
                  }`}
                  onClick={() => setSide("buy")}
                >
                  Buy
                </button>
                <button
                  type="button"
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    side === "sell"
                      ? "bg-terminal-negative/15 text-terminal-negative"
                      : TERMINAL_FILTER_CHIP
                  }`}
                  onClick={() => setSide("sell")}
                >
                  Sell
                </button>
              </div>
            </div>

            <label className={TERMINAL_FORM_GROUP}>
              <span className={TERMINAL_FORM_LABEL}>Qty</span>
              <input
                type="number"
                min={1}
                className={TERMINAL_INPUT}
                value={qty}
                onChange={(event) => setQty(Math.max(1, Math.trunc(Number(event.target.value) || 1)))}
              />
            </label>

            <label className={TERMINAL_FORM_GROUP}>
              <span className={TERMINAL_FORM_LABEL}>Order type</span>
              <select
                className={TERMINAL_INPUT}
                value={orderType}
                onChange={(event) => setOrderType(event.target.value as AlpacaOrderType)}
              >
                <option value="market">Market</option>
                <option value="limit">Limit</option>
              </select>
            </label>

            {orderType === "limit" ? (
              <label className={TERMINAL_FORM_GROUP}>
                <span className={TERMINAL_FORM_LABEL}>Limit price</span>
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  className={TERMINAL_INPUT}
                  value={Number.isFinite(limitPrice) ? limitPrice : 0}
                  onChange={(event) => setLimitPrice(Math.max(0, Number(event.target.value) || 0))}
                />
              </label>
            ) : null}

            <TerminalButton type="button" className="w-full" disabled={placing} onClick={() => void handlePlaceOrder()}>
              {placing ? t("common.loading") : t("alpaca.placeOrder", { defaultValue: "Place order" })}
            </TerminalButton>
          </div>
        </aside>
      </section>
    </div>
  );
}
