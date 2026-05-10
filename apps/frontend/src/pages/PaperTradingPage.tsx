import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { FeedbackToastStack, type FeedbackToast } from "../components/FeedbackToastStack";
import {
  api,
  getDecisionReceipts,
  postDecisionReceipt,
  runPreMortem,
  type DecisionReceipt,
  type PreMortemResponse,
} from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";
import { formatQuoteAge } from "../utils/formatQuoteAge";
import { ReactionSection } from "../components/ReactionSection";

type Direction = "LONG" | "SHORT";
type ExitAction = "HOLD" | "TIGHTEN_SL" | "SCALE_OUT" | "EXIT_NOW";

type OpenTradeForm = {
  ticker: string;
  direction: Direction;
  entryPrice: string;
  stopLoss: string;
  takeProfit: string;
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
  quoteUpdatedAt?: string;
  quoteSource?: string;
};

const USER_ID = "demo-user";
const PLN_PER_USD = 3.95;

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
  return n >= 0 ? "text-brand-green" : "text-brand-red";
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
  if (action === "SCALE_OUT") return "bg-brand-blue/20 text-brand-blue";
  return "animate-pulse bg-brand-red/20 text-brand-red";
}

export function PaperTradingPage() {
  const { t } = useTranslation();
  const [form, setForm] = useState<OpenTradeForm>({
    ticker: "",
    direction: "LONG",
    entryPrice: "",
    stopLoss: "",
    takeProfit: "",
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
  const [toasts, setToasts] = useState<FeedbackToast[]>([]);
  const [preMortemOpen, setPreMortemOpen] = useState(false);
  const [preMortemForm, setPreMortemForm] = useState({
    symbol: "",
    entry: "",
    stopLoss: "",
    takeProfit: "",
    quantity: "",
  });
  const [preMortemResult, setPreMortemResult] = useState<PreMortemResponse | null>(null);
  const [runningPreMortem, setRunningPreMortem] = useState(false);
  const [receipts, setReceipts] = useState<DecisionReceipt[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const pushToast = useCallback((tone: FeedbackToast["tone"], title: string, message?: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((prev) => [...prev.slice(-2), { id, tone, title, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 3400);
  }, []);

  const loadReceipts = useCallback(async () => {
    try {
      const { receipts: next } = await getDecisionReceipts(USER_ID, 40);
      setReceipts(next);
    } catch {
      setReceipts([]);
    }
  }, []);

  const loadData = useCallback(async () => {
    setError(null);
    setLoadingPortfolio(true);
    setLoadingHistory(true);
    void loadReceipts();
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
    const quoteMeta = new Map<string, { updatedAt?: string; source?: string }>();
    await Promise.all(
      openPositions.map(async (trade) => {
        try {
          const { data } = await api.get<{
            quote?: { price?: string | number; updatedAt?: string; source?: string };
          }>("/quotes/latest", {
            params: { ticker: trade.ticker },
          });
          const raw = data.quote?.price;
          const price = Number(raw);
          if (Number.isFinite(price) && price > 0) {
            priceMap.set(trade.id, price);
            quoteMeta.set(trade.id, {
              updatedAt: data.quote?.updatedAt,
              source: data.quote?.source,
            });
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
      const meta = quoteMeta.get(trade.id);
      return {
        ...trade,
        currentPrice,
        pnl,
        pnlPct,
        quoteUpdatedAt: meta?.updatedAt,
        quoteSource: meta?.source,
      };
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
  }, [loadReceipts]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const timer = setInterval(() => {
      void loadData();
    }, 30_000);
    return () => clearInterval(timer);
  }, [loadData]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 10_000);
    return () => window.clearInterval(id);
  }, []);

  const totalUnrealized = useMemo(
    () => positionRows.reduce((acc, row) => acc + row.pnl, 0),
    [positionRows],
  );

  const openTradeNow = async (
    payload: { ticker: string; entryPrice: number; quantity: number; direction: Direction },
    premortemSnapshot?: { result: PreMortemResponse; form: typeof preMortemForm },
  ) => {
    const ticker = payload.ticker.trim().toUpperCase();
    const entryPrice = payload.entryPrice;
    const quantity = payload.quantity;
    if (!ticker || !Number.isFinite(entryPrice) || entryPrice <= 0 || !Number.isFinite(quantity) || quantity <= 0) {
      setError("Uzupełnij poprawnie: ticker, entry price i quantity > 0.");
      pushToast("error", "Nieprawidłowe dane wejściowe", "Sprawdź ticker, cenę wejścia i ilość.");
      return;
    }
    setSubmittingOpen(true);
    setError(null);
    try {
      const { data: trade } = await api.post<PaperTrade>("/paper/trade/open", {
        userId: USER_ID,
        ticker,
        direction: payload.direction,
        entryPrice,
        quantity,
      });
      if (premortemSnapshot && trade?.id) {
        const { result, form } = premortemSnapshot;
        try {
          await postDecisionReceipt({
            userId: USER_ID,
            paperTradeId: trade.id,
            kind: "PROCEED_PREMORTEM",
            symbol: ticker,
            payload: {
              scenario: result.scenario,
              probability: result.probability,
              maxLoss: result.maxLoss,
              marketRegime: result.marketRegime,
              plannedEntry: Number(form.entry),
              plannedStop: Number(form.stopLoss),
              plannedTakeProfit: Number(form.takeProfit),
              quantity: Number(form.quantity),
            },
          });
          await loadReceipts();
        } catch {
          /* receipt is best-effort */
        }
      }
      setForm((prev) => ({ ...prev, ticker: "", entryPrice: "", stopLoss: "", takeProfit: "" }));
      await loadData();
      pushToast("success", "Pozycja otwarta", `${ticker} • ${payload.direction} • ${quantity}`);
    } catch (e) {
      if (isFallbackError(e)) {
        const fallbackTrade: PaperTrade = {
          id: `mock-open-${Date.now()}`,
          userId: USER_ID,
          ticker,
          direction: payload.direction,
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
        pushToast("info", "Pozycja zapisana lokalnie", `${ticker} dodany w trybie mock.`);
      } else {
        const nextError = apiErrorMessage(e);
        setError(nextError);
        pushToast("error", "Nie udało się otworzyć pozycji", nextError);
      }
    } finally {
      setSubmittingOpen(false);
    }
  };

  const onOpenTrade = async (event: React.FormEvent) => {
    event.preventDefault();
    const ticker = form.ticker.trim().toUpperCase();
    const entryPrice = Number(form.entryPrice);
    const quantity = Number(form.quantity);
    const stopLoss = Number(form.stopLoss);
    const takeProfit = Number(form.takeProfit);
    if (
      !ticker ||
      !Number.isFinite(entryPrice) ||
      entryPrice <= 0 ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      !Number.isFinite(stopLoss) ||
      !Number.isFinite(takeProfit)
    ) {
      setError("Uzupełnij poprawnie: ticker, entry/stop/take price i quantity > 0.");
      pushToast("error", "Nieprawidłowe dane wejściowe", "Wprowadź także stop loss i take profit.");
      return;
    }

    setPreMortemForm({
      symbol: ticker,
      entry: String(entryPrice),
      stopLoss: String(stopLoss),
      takeProfit: String(takeProfit),
      quantity: String(quantity),
    });
    setPreMortemResult(null);
    setPreMortemOpen(true);
  };

  async function onRunPreMortem(): Promise<void> {
    const entry = Number(preMortemForm.entry);
    const stopLoss = Number(preMortemForm.stopLoss);
    const takeProfit = Number(preMortemForm.takeProfit);
    const quantity = Number(preMortemForm.quantity);
    if (
      !preMortemForm.symbol ||
      !Number.isFinite(entry) ||
      !Number.isFinite(stopLoss) ||
      !Number.isFinite(takeProfit) ||
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      setError("Uzupełnij poprawnie dane Pre-Mortem.");
      return;
    }

    setRunningPreMortem(true);
    setError(null);
    try {
      const result = await runPreMortem({
        symbol: preMortemForm.symbol.trim().toUpperCase(),
        entry,
        stopLoss,
        takeProfit,
        quantity,
        userId: USER_ID,
      });
      setPreMortemResult(result);
    } catch (e) {
      const message = apiErrorMessage(e);
      setError(message);
      pushToast("error", "Pre-Mortem failed", message);
    } finally {
      setRunningPreMortem(false);
    }
  }

  async function onProceedAnyway(): Promise<void> {
    const ticker = preMortemForm.symbol.trim().toUpperCase();
    const entryPrice = Number(preMortemForm.entry);
    const quantity = Number(preMortemForm.quantity);
    const snapshot =
      preMortemResult != null ? { result: preMortemResult, form: { ...preMortemForm } } : undefined;
    await openTradeNow({ ticker, entryPrice, quantity, direction: form.direction }, snapshot);
    setPreMortemOpen(false);
  }

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
      const { data: closed } = await api.post<PaperTrade>("/paper/trade/close", { tradeId: trade.id, exitPrice });
      if (closed.pnl != null && closed.pnl < 0 && closed.id) {
        try {
          await postDecisionReceipt({
            userId: USER_ID,
            paperTradeId: closed.id,
            kind: "CLOSED_LOSS",
            symbol: closed.ticker,
            payload: {
              pnl: closed.pnl,
              pnlPct: closed.pnlPct ?? 0,
              exitPrice,
            },
          });
          await loadReceipts();
        } catch {
          /* best-effort */
        }
      }
      await loadData();
      pushToast("success", "Pozycja zamknięta", `${trade.ticker} @ ${formatMoney(exitPrice)}`);
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
        pushToast("info", "Zamknięto w trybie mock", `${trade.ticker} • ${formatPct(pnlPct)}`);
      } else {
        const nextError = apiErrorMessage(e);
        setError(nextError);
        pushToast("error", "Nie udało się zamknąć pozycji", nextError);
      }
    } finally {
      setClosingTradeId(null);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-white">{t("paperTrading.title")}</h1>
          <div className={`rounded px-3 py-1 text-xs ${usingMock ? "bg-orange-500/20 text-orange-200" : "bg-slate-700/40 text-slate-300"}`}>
            {usingMock ? "Mock fallback active" : "Live API"}
          </div>
        </header>

        {error && <div className="rounded border border-brand-red/30 bg-brand-red/10 p-3 text-sm text-brand-red">{error}</div>}
        <FeedbackToastStack toasts={toasts} />

        <section className="neo-panel neo-panel-accent rounded-xl p-4">
          <h2 className="mb-4 text-lg font-semibold text-white">{t("paperTrading.openPosition")}</h2>
          <form onSubmit={onOpenTrade} className="grid gap-3 md:grid-cols-6">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-400">Ticker</span>
              <input
                className="rounded border border-brand-border bg-brand-bg px-3 py-2 text-white outline-none focus:border-brand-blue"
                value={form.ticker}
                onChange={(e) => setForm((prev) => ({ ...prev, ticker: e.target.value.toUpperCase() }))}
                placeholder="AAPL"
              />
            </label>

            <div className="flex flex-col gap-1 text-sm">
              <span className="text-slate-400">{t("paperTrading.direction")}</span>
              <div className="flex overflow-hidden rounded border border-brand-border">
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, direction: "LONG" }))}
                  className={`flex-1 px-3 py-2 ${form.direction === "LONG" ? "bg-brand-green/20 text-brand-green" : "bg-brand-bg text-slate-300"}`}
                >
                  {t("paperTrading.long")}
                </button>
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, direction: "SHORT" }))}
                  className={`flex-1 px-3 py-2 ${form.direction === "SHORT" ? "bg-brand-red/20 text-brand-red" : "bg-brand-bg text-slate-300"}`}
                >
                  {t("paperTrading.short")}
                </button>
              </div>
            </div>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-400">{t("paperTrading.entryPrice")}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                className="rounded border border-brand-border bg-brand-bg px-3 py-2 text-white outline-none focus:border-brand-blue"
                value={form.entryPrice}
                onChange={(e) => setForm((prev) => ({ ...prev, entryPrice: e.target.value }))}
                placeholder="100.00"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-400">{t("premortem.stopLoss")}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                className="rounded border border-brand-border bg-brand-bg px-3 py-2 text-white outline-none focus:border-brand-blue"
                value={form.stopLoss}
                onChange={(e) => setForm((prev) => ({ ...prev, stopLoss: e.target.value }))}
                placeholder="95.00"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-400">{t("premortem.takeProfit")}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                className="rounded border border-brand-border bg-brand-bg px-3 py-2 text-white outline-none focus:border-brand-blue"
                value={form.takeProfit}
                onChange={(e) => setForm((prev) => ({ ...prev, takeProfit: e.target.value }))}
                placeholder="115.00"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-400">{t("paperTrading.quantity")}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                className="rounded border border-brand-border bg-brand-bg px-3 py-2 text-white outline-none focus:border-brand-blue"
                value={form.quantity}
                onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))}
                placeholder="1"
              />
            </label>

            <div className="md:col-span-6">
              <button
                type="submit"
                disabled={submittingOpen}
                className="interactive-tilt rounded bg-brand-amber px-4 py-2 text-sm font-semibold text-brand-bg transition hover:bg-brand-amber/85 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submittingOpen ? t("common.loading") : t("paperTrading.openPosition")}
              </button>
            </div>
          </form>
        </section>

        <section className="neo-panel rounded-xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">{t("paperTrading.portfolio")}</h2>
            <div className="text-right">
              <div className={`font-mono text-sm ${pnlClass(totalUnrealized)} ${totalUnrealized >= 0 ? "pnl-glow-positive" : "pnl-glow-negative"}`}>
                Unrealized: {formatMoney(totalUnrealized)}
              </div>
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
                    <th className="px-2 py-2">{t("paperTrading.direction")}</th>
                    <th className="px-2 py-2">{t("paperTrading.entryPrice")}</th>
                    <th className="px-2 py-2">Current Price</th>
                    <th className="px-2 py-2">{t("pearls.quoteFreshness")}</th>
                    <th className="px-2 py-2">{t("paperTrading.pnl")}</th>
                    <th className="px-2 py-2">PnL%</th>
                    <th className="px-2 py-2">Czas otwarcia</th>
                    <th className="px-2 py-2">Exit Signal</th>
                    <th className="px-2 py-2">{t("common.close")}</th>
                  </tr>
                </thead>
                <tbody>
                  {positionRows.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-2 py-6 text-center text-slate-500">
                        Brak aktywnych pozycji.
                      </td>
                    </tr>
                  )}
                  {positionRows.map((row) => {
                    const signal = exitSignals[row.id];
                    return (
                      <Fragment key={row.id}>
                      <tr className="border-b border-slate-900/80">
                        <td className="px-2 py-2 font-semibold text-white">{row.ticker}</td>
                        <td className={`px-2 py-2 ${row.direction === "LONG" ? "text-brand-green" : "text-brand-red"}`}>{row.direction === "LONG" ? t("paperTrading.long") : t("paperTrading.short")}</td>
                        <td className="px-2 py-2 font-mono">{formatMoney(row.entryPrice)}</td>
                        <td className="px-2 py-2 font-mono">{formatMoney(row.currentPrice)}</td>
                        <td className="px-2 py-2 text-xs text-slate-400">
                          {row.quoteUpdatedAt ? (
                            <span title={row.quoteUpdatedAt}>
                              {t("pearls.quoteChip", {
                                age: formatQuoteAge(row.quoteUpdatedAt, nowMs),
                                source: row.quoteSource ?? "—",
                              })}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className={`px-2 py-2 font-mono ${pnlClass(row.pnl)} ${row.pnl >= 0 ? "pnl-glow-positive" : "pnl-glow-negative"}`}>
                          {formatMoney(row.pnl)}
                        </td>
                        <td className={`px-2 py-2 font-mono ${pnlClass(row.pnlPct)} ${row.pnlPct >= 0 ? "pnl-glow-positive" : "pnl-glow-negative"}`}>
                          {formatPct(row.pnlPct)}
                        </td>
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
                            className="interactive-tilt rounded bg-brand-red/20 px-3 py-1 text-xs font-semibold text-brand-red hover:bg-brand-red/30 disabled:opacity-60"
                          >
                            {closingTradeId === row.id ? t("common.loading") : t("paperTrading.closePosition")}
                          </button>
                        </td>
                      </tr>
                      <tr className="border-b border-slate-900/60 bg-slate-950/30">
                        <td colSpan={10} className="px-2 py-2">
                          <ReactionSection variant="trade" tradeId={row.id} userId={USER_ID} />
                        </td>
                      </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="neo-panel rounded-xl p-4">
          <h2 className="mb-3 text-lg font-semibold text-white">{t("pearls.decisionTrailTitle")}</h2>
          {receipts.length === 0 ? (
            <p className="text-sm text-slate-500">{t("pearls.decisionTrailEmpty")}</p>
          ) : (
            <ul className="space-y-2 text-sm text-slate-200">
              {receipts.map((r) => {
                const pl = r.payload as Record<string, unknown>;
                const isProceed = r.kind === "PROCEED_PREMORTEM";
                return (
                  <li key={r.id} className="rounded-lg border border-slate-800 bg-brand-bg/60 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span>{new Date(r.createdAt).toLocaleString()}</span>
                      <span className="font-mono text-white">{r.symbol}</span>
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-200">
                        {isProceed ? t("pearls.receiptProceed") : t("pearls.receiptLoss")}
                      </span>
                    </div>
                    {isProceed ? (
                      <p className="mt-1 text-slate-300">
                        {String(pl.scenario ?? "").slice(0, 160)}
                        {String(pl.scenario ?? "").length > 160 ? "…" : ""}{" "}
                        <span className="text-brand-amber">({Number(pl.probability ?? 0)}%)</span>
                      </p>
                    ) : (
                      <p className="mt-1 text-slate-300">
                        {t("pearls.receiptLossDetail", {
                          pnl: Number(pl.pnl ?? 0).toFixed(2),
                          pct: Number(pl.pnlPct ?? 0).toFixed(2),
                        })}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="neo-panel rounded-xl p-4">
          <h2 className="mb-3 text-lg font-semibold text-white">{t("paperTrading.history")} (10)</h2>
          {loadingHistory ? (
            <TableSkeleton rows={5} />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-slate-400">
                  <tr className="border-b border-slate-800">
                    <th className="px-2 py-2">Ticker</th>
                    <th className="px-2 py-2">{t("paperTrading.direction")}</th>
                    <th className="px-2 py-2">Entry</th>
                    <th className="px-2 py-2">Exit</th>
                    <th className="px-2 py-2">{t("paperTrading.pnl")}</th>
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
                      <Fragment key={row.id}>
                      <tr className="border-b border-slate-900/80">
                        <td className="px-2 py-2 font-semibold text-white">{row.ticker}</td>
                        <td className={`px-2 py-2 ${row.direction === "LONG" ? "text-brand-green" : "text-brand-red"}`}>{row.direction === "LONG" ? t("paperTrading.long") : t("paperTrading.short")}</td>
                        <td className="px-2 py-2 font-mono">{formatMoney(row.entryPrice)}</td>
                        <td className="px-2 py-2 font-mono">{formatMoney(Number(row.exitPrice ?? row.entryPrice))}</td>
                        <td className={`px-2 py-2 font-mono ${pnlClass(pnl)} ${pnl >= 0 ? "pnl-glow-positive" : "pnl-glow-negative"}`}>
                          {formatMoney(pnl)}
                        </td>
                        <td className={`px-2 py-2 font-mono ${pnlClass(pnlPct)} ${pnlPct >= 0 ? "pnl-glow-positive" : "pnl-glow-negative"}`}>
                          {formatPct(pnlPct)}
                        </td>
                        <td className="px-2 py-2 text-xs text-slate-300">{durationText(row.entryAt, row.exitAt)}</td>
                      </tr>
                      <tr className="border-b border-slate-900/60 bg-slate-950/30">
                        <td colSpan={7} className="px-2 py-2">
                          <ReactionSection variant="trade" tradeId={row.id} userId={USER_ID} />
                        </td>
                      </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {preMortemOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-brand-border bg-brand-bg p-5 shadow-2xl">
            <h3 className="mb-4 text-lg font-bold text-white">🎯 PRE-MORTEM ANALYSIS</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-slate-400">{t("premortem.symbol")}</span>
                <input
                  className="rounded border border-brand-border bg-brand-bg px-3 py-2 text-white outline-none focus:border-brand-blue"
                  value={preMortemForm.symbol}
                  onChange={(e) => setPreMortemForm((prev) => ({ ...prev, symbol: e.target.value.toUpperCase() }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-slate-400">{t("premortem.quantity")}</span>
                <input
                  type="number"
                  className="rounded border border-brand-border bg-brand-bg px-3 py-2 text-white outline-none focus:border-brand-blue"
                  value={preMortemForm.quantity}
                  onChange={(e) => setPreMortemForm((prev) => ({ ...prev, quantity: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-slate-400">{t("premortem.entry")}</span>
                <input
                  type="number"
                  className="rounded border border-brand-border bg-brand-bg px-3 py-2 text-white outline-none focus:border-brand-blue"
                  value={preMortemForm.entry}
                  onChange={(e) => setPreMortemForm((prev) => ({ ...prev, entry: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-slate-400">{t("premortem.stopLoss")}</span>
                <input
                  type="number"
                  className="rounded border border-brand-border bg-brand-bg px-3 py-2 text-white outline-none focus:border-brand-blue"
                  value={preMortemForm.stopLoss}
                  onChange={(e) => setPreMortemForm((prev) => ({ ...prev, stopLoss: e.target.value }))}
                />
              </label>
              <label className="md:col-span-2 flex flex-col gap-1 text-sm">
                <span className="text-slate-400">{t("premortem.takeProfit")}</span>
                <input
                  type="number"
                  className="rounded border border-brand-border bg-brand-bg px-3 py-2 text-white outline-none focus:border-brand-blue"
                  value={preMortemForm.takeProfit}
                  onChange={(e) => setPreMortemForm((prev) => ({ ...prev, takeProfit: e.target.value }))}
                />
              </label>
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={() => void onRunPreMortem()}
                disabled={runningPreMortem}
                className="rounded bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue/85 disabled:opacity-60"
              >
                {runningPreMortem ? t("common.loading") : t("premortem.runButton")}
              </button>
            </div>

            {preMortemResult ? (
              <div className="mt-4 rounded-lg border border-brand-red/40 bg-brand-red/10 p-4">
                <p className="text-sm font-semibold text-brand-red">{t("premortem.lossScenario")}</p>
                <p className="mt-1 text-sm text-red-100">{preMortemResult.scenario}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-sm">
                  <span className="rounded bg-brand-amber/20 px-2 py-1 font-semibold text-brand-amber">
                    {preMortemResult.probability}% chance
                  </span>
                  <span className="rounded bg-slate-700/50 px-2 py-1 text-slate-200">
                    {Math.abs(preMortemResult.maxLoss).toFixed(2)} PLN (~{(Math.abs(preMortemResult.maxLoss) / PLN_PER_USD).toFixed(2)} USD)
                  </span>
                  <span className="rounded bg-slate-700/50 px-2 py-1 text-slate-300">
                    {t("premortem.marketRegime")}: {preMortemResult.marketRegime}
                  </span>
                </div>
              </div>
            ) : null}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => void onProceedAnyway()}
                disabled={!preMortemResult || submittingOpen}
                className="rounded bg-brand-green px-4 py-2 text-sm font-semibold text-white hover:bg-brand-green/85 disabled:opacity-50"
              >
                {t("premortem.proceed")}
              </button>
              <button
                type="button"
                onClick={() => setPreMortemOpen(false)}
                className="rounded border border-brand-border px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800/50"
              >
                {t("premortem.cancel")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TableSkeleton(props: { rows: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: props.rows }).map((_, idx) => (
        <div key={`sk-${idx}`} className="animate-pulse rounded border border-brand-border bg-brand-bg/70 p-3">
          <div className="h-4 w-1/4 rounded bg-slate-700/50" />
          <div className="mt-2 h-4 w-full rounded bg-slate-700/40" />
        </div>
      ))}
    </div>
  );
}
