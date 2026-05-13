import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BrokerCTAButton } from "../components/affiliate/BrokerCTAButton";
import {
  api,
  cancelAlpacaOrder,
  getAlpacaAccount,
  getAlpacaOrders,
  getAlpacaPortfolioHistory,
  getAlpacaPositions,
  placeAlpacaOrder,
} from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";

function readUserId(): string {
  if (typeof window === "undefined") return "demo-user";
  return window.localStorage.getItem("userId")?.trim() || "demo-user";
}

function asNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function AlpacaDashboardPage() {
  const { t } = useTranslation();
  const [userId] = useState(() => readUserId());
  const [account, setAccount] = useState<Record<string, unknown> | null>(null);
  const [mode, setMode] = useState<"paper" | "live">("paper");
  const [positions, setPositions] = useState<Record<string, unknown>[]>([]);
  const [orders, setOrders] = useState<Record<string, unknown>[]>([]);
  const [equity, setEquity] = useState<number[]>([]);
  const [timestamps, setTimestamps] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  const [symbol, setSymbol] = useState("AAPL");
  const [qty, setQty] = useState(1);
  const [tradeSide, setTradeSide] = useState<"buy" | "sell">("buy");
  const [placing, setPlacing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [premortem, setPremortem] = useState<Record<string, unknown> | null>(null);

  const chartData = useMemo(
    () =>
      equity.map((value, idx) => ({
        equity: value,
        t: new Date((timestamps[idx] ?? 0) * 1000).toLocaleDateString(undefined, {
          day: "numeric",
          month: "short",
        }),
      })),
    [equity, timestamps],
  );

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    setNotConfigured(false);
    try {
      const [acc, pos, ord, history] = await Promise.all([
        getAlpacaAccount(userId),
        getAlpacaPositions(userId),
        getAlpacaOrders(userId),
        getAlpacaPortfolioHistory(userId),
      ]);
      setAccount(acc.account);
      setMode(acc.mode);
      setPositions(pos.positions);
      setOrders(ord.orders.slice(0, 10));
      setEquity(history.equity);
      setTimestamps(history.timestamps);
    } catch (e) {
      const message = apiErrorMessage(e);
      setError(message);
      if (message.toLowerCase().includes("alpaca not configured")) setNotConfigured(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  async function openConfirm(side: "buy" | "sell"): Promise<void> {
    setTradeSide(side);
    setShowConfirm(true);
    setPremortem(null);
    try {
      const entry = 100;
      const stopLoss = entry * 0.95;
      const takeProfit = entry * 1.1;
      const { data } = await api.post("/premortem/analyze", {
        symbol: symbol.toUpperCase(),
        entry,
        stopLoss,
        takeProfit,
        quantity: qty,
        userId,
      });
      setPremortem(data as Record<string, unknown>);
    } catch {
      setPremortem(null);
    }
  }

  async function submitOrder(): Promise<void> {
    setPlacing(true);
    setError(null);
    try {
      await placeAlpacaOrder({
        userId,
        symbol: symbol.toUpperCase(),
        qty,
        side: tradeSide,
        type: "market",
      });
      setShowConfirm(false);
      await loadAll();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setPlacing(false);
    }
  }

  async function onCancelOrder(id: string): Promise<void> {
    try {
      await cancelAlpacaOrder(userId, id);
      await loadAll();
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 text-slate-100">
      <h1 className="text-3xl font-bold text-white">{t("alpaca.title", { defaultValue: "Alpaca Trading" })}</h1>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      {notConfigured && (
        <>
          <div className="mt-4 rounded-lg border border-amber-400/50 bg-amber-500/10 p-4 text-amber-200">
            {t("alpaca.connectBanner", { defaultValue: "Connect your Alpaca account in Settings" })}
          </div>
          <div className="mt-3 rounded-lg border border-brand-green/40 bg-brand-green/10 p-4">
            <p className="text-sm text-brand-green">
              {t("etoro.alpaca.banner", {
                defaultValue: "Don't have a US broker? Try eToro — trade stocks commission-free",
              })}
            </p>
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
        </>
      )}

      <section className="mt-6 rounded-xl border border-surface-border bg-surface-elevated/60 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("alpaca.account", { defaultValue: "Account" })}</h2>
          <span className="rounded-full border border-brand-blue/50 px-3 py-1 text-xs font-semibold text-brand-blue">
            {mode === "paper"
              ? t("alpaca.modePaper", { defaultValue: "PAPER" })
              : t("alpaca.modeLive", { defaultValue: "LIVE" })}
          </span>
        </div>
        {loading ? (
          <p className="text-sm text-slate-400">{t("common.loading")}</p>
        ) : (
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <Stat
              label={t("alpaca.buyingPower", { defaultValue: "Buying power" })}
              value={asNumber(account?.buying_power).toFixed(2)}
            />
            <Stat
              label={t("alpaca.portfolioValue", { defaultValue: "Portfolio value" })}
              value={asNumber(account?.portfolio_value).toFixed(2)}
            />
            <Stat label={t("alpaca.cash", { defaultValue: "Cash" })} value={asNumber(account?.cash).toFixed(2)} />
          </div>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-surface-border bg-surface-elevated/60 p-5">
        <h2 className="mb-3 text-lg font-semibold">{t("alpaca.quickTrade", { defaultValue: "Quick Trade" })}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            className="rounded-md border border-surface-border bg-surface px-3 py-2 text-white"
            placeholder={t("alpaca.symbol", { defaultValue: "Symbol" })}
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          />
          <input
            className="rounded-md border border-surface-border bg-surface px-3 py-2 text-white"
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
          />
          <div className="flex gap-2">
            <button
              className="rounded-md bg-brand-green/20 px-4 py-2 text-brand-green hover:bg-brand-green/30"
              onClick={() => void openConfirm("buy")}
            >
              {t("alpaca.buy", { defaultValue: "Buy" })}
            </button>
            <button className="rounded-md bg-red-500/20 px-4 py-2 text-red-300 hover:bg-red-500/30" onClick={() => void openConfirm("sell")}>
              {t("alpaca.sell", { defaultValue: "Sell" })}
            </button>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-surface-border bg-surface-elevated/60 p-5">
        <h2 className="mb-3 text-lg font-semibold">{t("alpaca.positions", { defaultValue: "Positions" })}</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="px-2 py-2">Symbol</th>
                <th className="px-2 py-2">Qty</th>
                <th className="px-2 py-2">{t("alpaca.avgPrice", { defaultValue: "Avg Price" })}</th>
                <th className="px-2 py-2">{t("alpaca.currentPrice", { defaultValue: "Current Price" })}</th>
                <th className="px-2 py-2">P&L</th>
                <th className="px-2 py-2">P&L%</th>
              </tr>
            </thead>
            <tbody>
              {positions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-2 py-4 text-slate-500">
                    {t("alpaca.noPositions", { defaultValue: "No open positions" })}
                  </td>
                </tr>
              )}
              {positions.map((p) => (
                <tr key={String(p.symbol)} className="border-t border-surface-border/70">
                  <td className="px-2 py-2">{String(p.symbol)}</td>
                  <td className="px-2 py-2">{String(p.qty ?? "0")}</td>
                  <td className="px-2 py-2">{String(p.avg_entry_price ?? "0")}</td>
                  <td className="px-2 py-2">{String(p.current_price ?? "0")}</td>
                  <td className="px-2 py-2">{String(p.unrealized_pl ?? "0")}</td>
                  <td className="px-2 py-2">{String(p.unrealized_plpc ?? "0")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-surface-border bg-surface-elevated/60 p-5">
        <h2 className="mb-3 text-lg font-semibold">{t("alpaca.orders", { defaultValue: "Orders" })}</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="px-2 py-2">Symbol</th>
                <th className="px-2 py-2">{t("alpaca.qty", { defaultValue: "Qty" })}</th>
                <th className="px-2 py-2">{t("alpaca.status", { defaultValue: "Status" })}</th>
                <th className="px-2 py-2">{t("alpaca.side", { defaultValue: "Side" })}</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-2 py-4 text-slate-500">
                    {t("alpaca.noOrders", { defaultValue: "No recent orders" })}
                  </td>
                </tr>
              )}
              {orders.map((o) => {
                const id = String(o.id ?? "");
                const status = String(o.status ?? "unknown");
                return (
                  <tr key={id} className="border-t border-surface-border/70">
                    <td className="px-2 py-2">{String(o.symbol ?? "-")}</td>
                    <td className="px-2 py-2">{String(o.qty ?? "-")}</td>
                    <td className="px-2 py-2">
                      <span className="rounded border border-slate-500/50 px-2 py-0.5 text-xs">{status}</span>
                    </td>
                    <td className="px-2 py-2">{String(o.side ?? "-")}</td>
                    <td className="px-2 py-2 text-right">
                      {status !== "filled" && status !== "canceled" ? (
                        <button className="text-xs text-red-300 hover:underline" onClick={() => void onCancelOrder(id)}>
                          {t("alpaca.cancel", { defaultValue: "Cancel" })}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-surface-border bg-surface-elevated/60 p-5">
        <h2 className="mb-3 text-lg font-semibold">{t("alpaca.equityCurve", { defaultValue: "Equity curve (30d)" })}</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis dataKey="t" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <Tooltip />
              <Line dataKey="equity" stroke="#60a5fa" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {showConfirm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-xl border border-surface-border bg-surface p-5">
            <h3 className="text-lg font-semibold text-white">{t("alpaca.confirmTrade", { defaultValue: "Confirm Trade" })}</h3>
            <p className="mt-2 text-sm text-slate-400">
              {tradeSide.toUpperCase()} {qty} {symbol}
            </p>
            <div className="mt-3 rounded-lg border border-surface-border bg-surface-elevated/60 p-3 text-sm text-slate-300">
              <div className="mb-2 font-semibold text-white">{t("alpaca.premortem", { defaultValue: "Pre-Mortem" })}</div>
              {premortem ? (
                <p>{String(premortem.scenario ?? "-")}</p>
              ) : (
                <p className="text-slate-500">{t("common.loading")}</p>
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded-md border border-surface-border px-4 py-2 text-sm text-slate-200" onClick={() => setShowConfirm(false)}>
                {t("common.cancel")}
              </button>
              <button className="rounded-md bg-accent px-4 py-2 text-sm text-white" disabled={placing} onClick={() => void submitOrder()}>
                {placing ? t("common.loading") : t("alpaca.confirm", { defaultValue: "Confirm" })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-surface-border bg-surface p-3">
      <div className="text-xs uppercase text-slate-400">{label}</div>
      <div className="mt-1 font-mono text-lg text-white">{value}</div>
    </div>
  );
}

