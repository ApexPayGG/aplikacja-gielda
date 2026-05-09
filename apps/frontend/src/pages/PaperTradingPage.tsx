import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { api } from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";

type Direction = "LONG" | "SHORT";
type ExitAction = "HOLD" | "TIGHTEN_SL" | "SCALE_OUT" | "EXIT_NOW";

type OpenTradeForm = {
  ticker: string;
  direction: Direction;
  entryPrice: string;
  quantity: string;
};

type PaperTrade = {
  id: string;
  userId: string;
  ticker: string;
  direction: Direction;
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  entryAt: string;
  exitAt?: string;
  status: "OPEN" | "CLOSED";
  pnl?: number;
  pnlPct?: number;
};

type PortfolioResponse = {
  openPositions: PaperTrade[];
  totalUnrealizedPnl: number;
};

type HistoryResponse = {
  count: number;
  data: PaperTrade[];
};

type ExitSignal = {
  tradeId: string;
  ticker: string;
  action: ExitAction;
  reason: string;
  urgency: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  currentPnlPct: number;
  aiAdvice: string;
};

type PositionRow = PaperTrade & {
  currentPrice: number;
  pnl: number;
  pnlPct: number;
};

const USER_ID = "demo-user";

const mockPortfolio: PortfolioResponse = {
  openPositions: [
    {
      id: "pt-open-1",
      userId: USER_ID,
      ticker: "AAPL",
      direction: "LONG",
      entryPrice: 186.25,
      quantity: 15,
      entryAt: "2026-05-08T13:10:00.000Z",
      status: "OPEN",
    },
    {
      id: "pt-open-2",
      userId: USER_ID,
      ticker: "MSFT",
      direction: "SHORT",
      entryPrice: 432.5,
      quantity: 8,
      entryAt: "2026-05-09T08:20:00.000Z",
      status: "OPEN",
    },
  ],
  totalUnrealizedPnl: 184.5,
};

const mockHistory: HistoryResponse = {
  count: 10,
  data: [
    {
      id: "pt-h-1",
      userId: USER_ID,
      ticker: "NVDA",
      direction: "LONG",
      entryPrice: 915,
      exitPrice: 944,
      quantity: 3,
      entryAt: "2026-05-04T09:00:00.000Z",
      exitAt: "2026-05-05T12:00:00.000Z",
      status: "CLOSED",
      pnl: 87,
      pnlPct: 3.17,
    },
    {
      id: "pt-h-2",
      userId: USER_ID,
      ticker: "TSLA",
      direction: "SHORT",
      entryPrice: 181,
      exitPrice: 176,
      quantity: 20,
      entryAt: "2026-05-01T11:00:00.000Z",
      exitAt: "2026-05-01T18:30:00.000Z",
      status: "CLOSED",
      pnl: 100,
      pnlPct: 2.76,
    },
    {
      id: "pt-h-3",
      userId: USER_ID,
      ticker: "PKN",
      direction: "LONG",
      entryPrice: 67.8,
      exitPrice: 66.5,
      quantity: 40,
      entryAt: "2026-04-29T08:00:00.000Z",
      exitAt: "2026-04-30T14:00:00.000Z",
      status: "CLOSED",
      pnl: -52,
      pnlPct: -1.92,
    },
  ],
};

const mockExitSignals: Record<string, ExitSignal> = {
  "pt-open-1": {
    tradeId: "pt-open-1",
    ticker: "AAPL",
    action: "HOLD",
    reason: "Pozycja rozwija się zgodnie z oczekiwaniami.",
    urgency: "LOW",
    currentPnlPct: 1.2,
    aiAdvice: "Trzymaj pozycję i obserwuj wolumen.",
  },
  "pt-open-2": {
    tradeId: "pt-open-2",
    ticker: "MSFT",
    action: "TIGHTEN_SL",
    reason: "Zabezpiecz zysk na podwyższonej zmienności.",
    urgency: "HIGH",
    currentPnlPct: 2.8,
    aiAdvice: "Podnieś stop i pilnuj słabości rynku.",
  },
};

function isFallbackError(e: unknown): boolean {
  return axios.isAxiosError(e) && (!e.response || e.response.status === 404 || e.response.status >= 500);
}

function formatMoney(n: number): string {
  return `$${n.toFixed(2)}`;
}

function formatPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function pnlClass(n: number): string {
  return n >= 0 ? "text-[#00c87a]" : "text-[#ff4a4a]";
}

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate(value?: string): string {
  const d = parseDate(value);
  if (!d) return "n/a";
  return d.toLocaleString();
}

function durationText(start?: string, end?: string): string {
  const a = parseDate(start);
  const b = parseDate(end);
  if (!a || !b) return "n/a";
  const ms = Math.max(0, b.getTime() - a.getTime());
  const h = Math.floor(ms / (1000 * 60 * 60));
  const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `${h}h ${m}m`;
}

function computeUnrealized(trade: PaperTrade, currentPrice: number): { pnl: number; pnlPct: number } {
  const qty = Number(trade.quantity) || 0;
  const entry = Number(trade.entryPrice) || 0;
  if (entry <= 0 || qty <= 0) return { pnl: 0, pnlPct: 0 };
  const pnl = trade.direction === "LONG" ? (currentPrice - entry) * qty : (entry - currentPrice) * qty;
  const pnlPct = (pnl / (entry * qty)) * 100;
  return { pnl, pnlPct };
}

function exitBadgeClass(action: ExitAction): string {
  if (action === "HOLD") return "bg-slate-700/40 text-slate-300";
  if (action === "TIGHTEN_SL") return "bg-orange-500/20 text-orange-300";
  if (action === "SCALE_OUT") return "bg-[#0096ff]/20 text-[#7fc9ff]";
  return "animate-pulse bg-[#ff4a4a]/20 text-[#ff7a7a]";
}

export function PaperTradingPage() {
  const [form, setForm] = useState<OpenTradeForm>({
    ticker: "",
    direction: "LONG",
    entryPrice: "",
    quantity: "1",
  });
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [history, setHistory] = useState<PaperTrade[]>([]);
  const [positionRows, setPositionRows] = useState<PositionRow[]>([]);
  const [exitSignals, setExitSignals] = useState<Record<string, ExitSignal>>({});
  const [loadingPortfolio, setLoadingPortfolio] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [submittingOpen, setSubmittingOpen] = useState(false);
  const [closingTradeId, setClosingTradeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usingMock, setUsingMock] = useState(false);

  const loadData = useCallback(async () => {
    setError(null);
    setLoadingPortfolio(true);
    setLoadingHistory(true);
    let openPositions: PaperTrade[] = [];
    let portfolioFallback = false;
    let historyFallback = false;
    try {
      const { data } = await api.get<PortfolioResponse>(`/paper/portfolio/${encodeURIComponent(USER_ID)}`);
      openPositions = Array.isArray(data.openPositions) ? data.openPositions : [];
      setPortfolio({
        openPositions,
        totalUnrealizedPnl: Number(data.totalUnrealizedPnl ?? 0),
      });
    } catch (e) {
      if (isFallbackError(e)) {
        portfolioFallback = true;
        openPositions = mockPortfolio.openPositions;
        setPortfolio(mockPortfolio);
      } else {
        setPortfolio({ openPositions: [], totalUnrealizedPnl: 0 });
        setError(apiErrorMessage(e));
      }
    } finally {
      setLoadingPortfolio(false);
    }

    try {
      const { data } = await api.get<HistoryResponse>(`/paper/history/${encodeURIComponent(USER_ID)}`);
      const rows = Array.isArray(data.data) ? data.data : [];
      setHistory(rows.slice(0, 10));
    } catch (e) {
      if (isFallbackError(e)) {
        historyFallback = true;
        setHistory(mockHistory.data.slice(0, 10));
      } else {
        setHistory([]);
        setError((prev) => prev ?? apiErrorMessage(e));
      }
    } finally {
      setLoadingHistory(false);
    }

    const priceMap = new Map<string, number>();
    await Promise.all(
      openPositions.map(async (trade) => {
        try {
          const { data } = await api.get<{ quote?: { price?: string | number } }>("/quotes/latest", {
            params: { ticker: trade.ticker },
          });
          const raw = data.quote?.price;
          const price = Number(raw);
          if (Number.isFinite(price) && price > 0) {
            priceMap.set(trade.id, price);
            return;
          }
          priceMap.set(trade.id, trade.entryPrice);
        } catch {
          priceMap.set(trade.id, trade.entryPrice);
        }
      }),
    );

    const nextRows: PositionRow[] = openPositions.map((trade) => {
      const currentPrice = priceMap.get(trade.id) ?? trade.entryPrice;
      const { pnl, pnlPct } = computeUnrealized(trade, currentPrice);
      return { ...trade, currentPrice, pnl, pnlPct };
    });
    setPositionRows(nextRows);

    const nextExitSignals: Record<string, ExitSignal> = {};
    await Promise.all(
      openPositions.map(async (trade) => {
        try {
          const { data } = await api.get<ExitSignal>(`/paper/exit/${encodeURIComponent(trade.id)}`);
          nextExitSignals[trade.id] = data;
        } catch {
          nextExitSignals[trade.id] =
            mockExitSignals[trade.id] ??
            ({
              tradeId: trade.id,
              ticker: trade.ticker,
              action: "HOLD",
              reason: "Brak sygnału wyjścia.",
              urgency: "LOW",
              currentPnlPct: 0,
              aiAdvice: "Monitoruj pozycję.",
            } as ExitSignal);
        }
      }),
    );
    setExitSignals(nextExitSignals);
    setUsingMock(portfolioFallback || historyFallback);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const timer = setInterval(() => {
      void loadData();
    }, 30_000);
    return () => clearInterval(timer);
  }, [loadData]);

  const totalUnrealized = useMemo(
    () => positionRows.reduce((acc, row) => acc + row.pnl, 0),
    [positionRows],
  );

  const onOpenTrade = async (event: React.FormEvent) => {
    event.preventDefault();
    const ticker = form.ticker.trim().toUpperCase();
    const entryPrice = Number(form.entryPrice);
    const quantity = Number(form.quantity);
    if (!ticker || !Number.isFinite(entryPrice) || entryPrice <= 0 || !Number.isFinite(quantity) || quantity <= 0) {
      setError("Uzupełnij poprawnie: ticker, entry price i quantity > 0.");
      return;
    }
    setSubmittingOpen(true);
    setError(null);
    try {
      await api.post("/paper/trade/open", {
        userId: USER_ID,
        ticker,
        direction: form.direction,
        entryPrice,
        quantity,
      });
      setForm((prev) => ({ ...prev, ticker: "", entryPrice: "" }));
      await loadData();
    } catch (e) {
      if (isFallbackError(e)) {
        const fallbackTrade: PaperTrade = {
          id: `mock-open-${Date.now()}`,
          userId: USER_ID,
          ticker,
          direction: form.direction,
          entryPrice,
          quantity,
          entryAt: new Date().toISOString(),
          status: "OPEN",
        };
        setPortfolio((prev) => ({
          openPositions: [fallbackTrade, ...(prev?.openPositions ?? [])],
          totalUnrealizedPnl: prev?.totalUnrealizedPnl ?? 0,
        }));
        setPositionRows((prev) => [{ ...fallbackTrade, currentPrice: entryPrice, pnl: 0, pnlPct: 0 }, ...prev]);
        setUsingMock(true);
      } else {
        setError(apiErrorMessage(e));
      }
    } finally {
      setSubmittingOpen(false);
    }
  };

  const onCloseTrade = async (trade: PositionRow) => {
    setClosingTradeId(trade.id);
    setError(null);
    try {
      const quoteRes = await api.get<{ quote?: { price?: string | number } }>("/quotes/latest", {
        params: { ticker: trade.ticker },
      });
      const exitPrice = Number(quoteRes.data.quote?.price);
      if (!Number.isFinite(exitPrice) || exitPrice <= 0) {
        throw new Error("Nie udało się pobrać aktualnej ceny.");
      }
      await api.post("/paper/trade/close", { tradeId: trade.id, exitPrice });
      await loadData();
    } catch (e) {
      if (isFallbackError(e)) {
        const exitPrice = trade.currentPrice;
        const { pnl, pnlPct } = computeUnrealized(trade, exitPrice);
        const closedTrade: PaperTrade = {
          ...trade,
          exitPrice,
          exitAt: new Date().toISOString(),
          status: "CLOSED",
          pnl,
          pnlPct,
        };
        setPositionRows((prev) => prev.filter((x) => x.id !== trade.id));
        setPortfolio((prev) => ({
          openPositions: (prev?.openPositions ?? []).filter((x) => x.id !== trade.id),
          totalUnrealizedPnl: 0,
        }));
        setHistory((prev) => [closedTrade, ...prev].slice(0, 10));
        setUsingMock(true);
      } else {
        setError(apiErrorMessage(e));
      }
    } finally {
      setClosingTradeId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#060d18] text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-white">Paper Trading</h1>
          <div className={`rounded px-3 py-1 text-xs ${usingMock ? "bg-orange-500/20 text-orange-200" : "bg-slate-700/40 text-slate-300"}`}>
            {usingMock ? "Mock fallback active" : "Live API"}
          </div>
        </header>

        {error && <div className="rounded border border-[#ff4a4a]/30 bg-[#ff4a4a]/10 p-3 text-sm text-[#ff7a7a]">{error}</div>}

        <section className="rounded-xl border border-slate-800 bg-slate-900/65 p-4">
          <h2 className="mb-4 text-lg font-semibold text-white">Otwórz pozycję</h2>
          <form onSubmit={onOpenTrade} className="grid gap-3 md:grid-cols-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-400">Ticker</span>
              <input
                className="rounded border border-slate-700 bg-[#060d18] px-3 py-2 text-white outline-none focus:border-[#0096ff]"
                value={form.ticker}
                onChange={(e) => setForm((prev) => ({ ...prev, ticker: e.target.value.toUpperCase() }))}
                placeholder="AAPL"
              />
            </label>

            <div className="flex flex-col gap-1 text-sm">
              <span className="text-slate-400">Direction</span>
              <div className="flex overflow-hidden rounded border border-slate-700">
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, direction: "LONG" }))}
                  className={`flex-1 px-3 py-2 ${form.direction === "LONG" ? "bg-[#00c87a]/20 text-[#00c87a]" : "bg-[#060d18] text-slate-300"}`}
                >
                  LONG
                </button>
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, direction: "SHORT" }))}
                  className={`flex-1 px-3 py-2 ${form.direction === "SHORT" ? "bg-[#ff4a4a]/20 text-[#ff7a7a]" : "bg-[#060d18] text-slate-300"}`}
                >
                  SHORT
                </button>
              </div>
            </div>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-400">Entry Price</span>
              <input
                type="number"
                min="0"
                step="0.01"
                className="rounded border border-slate-700 bg-[#060d18] px-3 py-2 text-white outline-none focus:border-[#0096ff]"
                value={form.entryPrice}
                onChange={(e) => setForm((prev) => ({ ...prev, entryPrice: e.target.value }))}
                placeholder="100.00"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-400">Quantity</span>
              <input
                type="number"
                min="0"
                step="0.01"
                className="rounded border border-slate-700 bg-[#060d18] px-3 py-2 text-white outline-none focus:border-[#0096ff]"
                value={form.quantity}
                onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))}
                placeholder="1"
              />
            </label>

            <div className="md:col-span-4">
              <button
                type="submit"
                disabled={submittingOpen}
                className="rounded bg-[#0096ff] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#007ad0] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submittingOpen ? "Otwieranie..." : "Otwórz pozycję"}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/65 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Aktywne pozycje</h2>
            <div className="text-right">
              <div className={`font-mono text-sm ${pnlClass(totalUnrealized)}`}>Unrealized: {formatMoney(totalUnrealized)}</div>
              <div className="text-xs text-slate-500">Open trades: {portfolio?.openPositions.length ?? 0}</div>
            </div>
          </div>
          {loadingPortfolio ? (
            <TableSkeleton rows={4} />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-slate-400">
                  <tr className="border-b border-slate-800">
                    <th className="px-2 py-2">Ticker</th>
                    <th className="px-2 py-2">Direction</th>
                    <th className="px-2 py-2">Entry Price</th>
                    <th className="px-2 py-2">Current Price</th>
                    <th className="px-2 py-2">PnL</th>
                    <th className="px-2 py-2">PnL%</th>
                    <th className="px-2 py-2">Czas otwarcia</th>
                    <th className="px-2 py-2">Exit Signal</th>
                    <th className="px-2 py-2">Akcja</th>
                  </tr>
                </thead>
                <tbody>
                  {positionRows.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-2 py-6 text-center text-slate-500">
                        Brak aktywnych pozycji.
                      </td>
                    </tr>
                  )}
                  {positionRows.map((row) => {
                    const signal = exitSignals[row.id];
                    return (
                      <tr key={row.id} className="border-b border-slate-900/80">
                        <td className="px-2 py-2 font-semibold text-white">{row.ticker}</td>
                        <td className={`px-2 py-2 ${row.direction === "LONG" ? "text-[#00c87a]" : "text-[#ff7a7a]"}`}>{row.direction}</td>
                        <td className="px-2 py-2 font-mono">{formatMoney(row.entryPrice)}</td>
                        <td className="px-2 py-2 font-mono">{formatMoney(row.currentPrice)}</td>
                        <td className={`px-2 py-2 font-mono ${pnlClass(row.pnl)}`}>{formatMoney(row.pnl)}</td>
                        <td className={`px-2 py-2 font-mono ${pnlClass(row.pnlPct)}`}>{formatPct(row.pnlPct)}</td>
                        <td className="px-2 py-2 text-xs text-slate-300">{formatDate(row.entryAt)}</td>
                        <td className="px-2 py-2">
                          <span className={`rounded px-2 py-1 text-xs font-semibold ${exitBadgeClass(signal?.action ?? "HOLD")}`}>
                            {signal?.action ?? "HOLD"}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            disabled={closingTradeId === row.id}
                            onClick={() => void onCloseTrade(row)}
                            className="rounded bg-[#ff4a4a]/20 px-3 py-1 text-xs font-semibold text-[#ff7a7a] hover:bg-[#ff4a4a]/30 disabled:opacity-60"
                          >
                            {closingTradeId === row.id ? "Zamykanie..." : "Zamknij"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/65 p-4">
          <h2 className="mb-3 text-lg font-semibold text-white">Historia (ostatnie 10)</h2>
          {loadingHistory ? (
            <TableSkeleton rows={5} />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-slate-400">
                  <tr className="border-b border-slate-800">
                    <th className="px-2 py-2">Ticker</th>
                    <th className="px-2 py-2">Direction</th>
                    <th className="px-2 py-2">Entry</th>
                    <th className="px-2 py-2">Exit</th>
                    <th className="px-2 py-2">PnL</th>
                    <th className="px-2 py-2">PnL%</th>
                    <th className="px-2 py-2">Czas trwania</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-2 py-6 text-center text-slate-500">
                        Brak historii transakcji.
                      </td>
                    </tr>
                  )}
                  {history.slice(0, 10).map((row) => {
                    const pnl = Number(row.pnl ?? 0);
                    const pnlPct = Number(row.pnlPct ?? 0);
                    return (
                      <tr key={row.id} className="border-b border-slate-900/80">
                        <td className="px-2 py-2 font-semibold text-white">{row.ticker}</td>
                        <td className={`px-2 py-2 ${row.direction === "LONG" ? "text-[#00c87a]" : "text-[#ff7a7a]"}`}>{row.direction}</td>
                        <td className="px-2 py-2 font-mono">{formatMoney(row.entryPrice)}</td>
                        <td className="px-2 py-2 font-mono">{formatMoney(Number(row.exitPrice ?? row.entryPrice))}</td>
                        <td className={`px-2 py-2 font-mono ${pnlClass(pnl)}`}>{formatMoney(pnl)}</td>
                        <td className={`px-2 py-2 font-mono ${pnlClass(pnlPct)}`}>{formatPct(pnlPct)}</td>
                        <td className="px-2 py-2 text-xs text-slate-300">{durationText(row.entryAt, row.exitAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function TableSkeleton(props: { rows: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: props.rows }).map((_, idx) => (
        <div key={`sk-${idx}`} className="animate-pulse rounded border border-slate-800 bg-[#060d18]/70 p-3">
          <div className="h-4 w-1/4 rounded bg-slate-700/50" />
          <div className="mt-2 h-4 w-full rounded bg-slate-700/40" />
        </div>
      ))}
    </div>
  );
}
