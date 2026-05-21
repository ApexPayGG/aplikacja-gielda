import { useCallback, useEffect, useMemo, useState } from "react";
import { PrinterIcon } from "@heroicons/react/24/outline";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { BulkActions, BulkRowCheckbox } from "../components/BulkActions";
import { ExportButton } from "../components/ExportButton";
import { FeedbackToastStack, type FeedbackToast } from "../components/FeedbackToastStack";
import { useAuth } from "../context/AuthContext";
import {
  api,
  createPostTradeReflection,
  getDecisionReceipts,
  postDecisionReceipt,
  runPreMortem,
  type DecisionReceipt,
  type PreMortemResponse,
} from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";
import { formatQuoteAge } from "../utils/formatQuoteAge";
import { formatCurrency, formatDate, formatNumber, formatPercent } from "../utils/formatters";
import { printPortfolioReport } from "../utils/printReport";
import { colors } from "../styles/designSystem";

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

type ReflectionEmotion = "FRUSTRATION" | "FEAR" | "CONFIDENT" | "NEUTRAL" | "GREEDY";

type PositionRow = PaperTrade & {
  currentPrice: number;
  pnl: number;
  pnlPct: number;
  quoteUpdatedAt?: string;
  quoteSource?: string;
};

const PLN_PER_USD = 3.95;
const REFLECTION_MODAL_DURATION_SEC = 30;
const REFLECTION_INSIGHT_DURATION_MS = 3000;
const MOCK_USER_ID = "mock-user";

const mockPortfolio: PortfolioResponse = {
  openPositions: [
    {
      id: "pt-open-1",
      userId: MOCK_USER_ID,
      ticker: "AAPL",
      direction: "LONG",
      entryPrice: 186.25,
      quantity: 15,
      entryAt: "2026-05-08T13:10:00.000Z",
      status: "OPEN",
    },
    {
      id: "pt-open-2",
      userId: MOCK_USER_ID,
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
      userId: MOCK_USER_ID,
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
      userId: MOCK_USER_ID,
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
      userId: MOCK_USER_ID,
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

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
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

type QuoteFreshnessTone = "FRESH" | "DELAYED" | "STALE";

function quoteFreshnessTone(updatedAt?: string, nowMs = Date.now()): QuoteFreshnessTone {
  const parsed = parseDate(updatedAt);
  if (!parsed) return "STALE";
  const ageMs = Math.max(0, nowMs - parsed.getTime());
  if (ageMs <= 60_000) return "FRESH";
  if (ageMs <= 15 * 60_000) return "DELAYED";
  return "STALE";
}

function quoteFreshnessToneClass(tone: QuoteFreshnessTone): string {
  if (tone === "FRESH") return "border border-brand-green/45 bg-brand-green/10 text-brand-green";
  if (tone === "DELAYED") return "border border-brand-blue/40 bg-brand-blue/10 text-brand-blue";
  return "border border-brand-red/40 bg-brand-red/10 text-brand-red";
}

function emotionLabel(t: (key: string) => string, emotion: ReflectionEmotion): string {
  return t(`reflection.emotions.${emotion}`);
}

export function PaperTradingPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const USER_ID = user?.id ?? "";
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
  const [openTradePanelVisible, setOpenTradePanelVisible] = useState(false);
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
  const [reflectionTrade, setReflectionTrade] = useState<PositionRow | null>(null);
  const [reflectionSubmitting, setReflectionSubmitting] = useState(false);
  const [reflectionTimerSec, setReflectionTimerSec] = useState(REFLECTION_MODAL_DURATION_SEC);
  const [reflectionFollowedPlan, setReflectionFollowedPlan] = useState(true);
  const [reflectionEmotion, setReflectionEmotion] = useState<ReflectionEmotion>("NEUTRAL");
  const [reflectionLesson, setReflectionLesson] = useState("");
  const [reflectionInsight, setReflectionInsight] = useState<string | null>(null);
  const [selectedTradeIds, setSelectedTradeIds] = useState<string[]>([]);
  const [bulkClosing, setBulkClosing] = useState(false);

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

  useEffect(() => {
    if (!reflectionTrade) return;
    setReflectionTimerSec(REFLECTION_MODAL_DURATION_SEC);
    const id = window.setInterval(() => {
      setReflectionTimerSec((prev) => {
        if (prev <= 1) {
          window.clearInterval(id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [reflectionTrade]);

  useEffect(() => {
    if (!reflectionTrade) return;
    if (reflectionTimerSec > 0) return;
    void closeTradeWithoutReflection();
  }, [reflectionTimerSec, reflectionTrade]);

  useEffect(() => {
    if (!reflectionInsight) return;
    const id = window.setTimeout(() => setReflectionInsight(null), REFLECTION_INSIGHT_DURATION_MS);
    return () => window.clearTimeout(id);
  }, [reflectionInsight]);

  useEffect(() => {
    const availableIds = new Set(positionRows.map((row) => row.id));
    setSelectedTradeIds((prev) => prev.filter((id) => availableIds.has(id)));
  }, [positionRows]);

  const totalUnrealized = useMemo(
    () => positionRows.reduce((acc, row) => acc + row.pnl, 0),
    [positionRows],
  );
  const realizedPnl = useMemo(() => history.reduce((acc, row) => acc + Number(row.pnl ?? 0), 0), [history]);
  const portfolioBalance = totalUnrealized + realizedPnl;
  const closedCount = history.length;
  const winCount = useMemo(() => history.filter((row) => Number(row.pnl ?? 0) > 0).length, [history]);
  const winRate = closedCount > 0 ? (winCount / closedCount) * 100 : 0;
  const bestTrade = useMemo(() => {
    return history.reduce<PaperTrade | null>((best, row) => {
      if (!best) return row;
      return Number(row.pnl ?? 0) > Number(best.pnl ?? 0) ? row : best;
    }, null);
  }, [history]);
  const selectedOpenTrades = useMemo(
    () => positionRows.filter((row) => selectedTradeIds.includes(row.id)),
    [positionRows, selectedTradeIds],
  );
  const allOpenTradesSelected = positionRows.length > 0 && selectedOpenTrades.length === positionRows.length;

  const toggleSelectAllOpenTrades = useCallback((checked: boolean) => {
    setSelectedTradeIds(checked ? positionRows.map((row) => row.id) : []);
  }, [positionRows]);

  const toggleTradeSelection = useCallback((tradeId: string, checked: boolean) => {
    setSelectedTradeIds((prev) => {
      if (checked) return prev.includes(tradeId) ? prev : [...prev, tradeId];
      return prev.filter((id) => id !== tradeId);
    });
  }, []);

  const clearSelectedTrades = useCallback(() => {
    setSelectedTradeIds([]);
  }, []);

  const exportSelectedTrades = useCallback(() => {
    if (selectedOpenTrades.length === 0) return;
    const rows = [
      ["Ticker", "Direction", "Entry Price", "Current Price", "Quantity", "P&L", "P&L %", "Entry At"],
      ...selectedOpenTrades.map((trade) => [
        trade.ticker,
        trade.direction,
        String(trade.entryPrice),
        String(trade.currentPrice),
        String(trade.quantity),
        String(trade.pnl),
        String(trade.pnlPct),
        trade.entryAt,
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const file = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `stockai-selected-trades-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    pushToast("success", "Eksport gotowy", `Wyeksportowano ${selectedOpenTrades.length} pozycji.`);
  }, [pushToast, selectedOpenTrades]);

  const onPrintReport = useCallback(() => {
    const tradesForPrint = [
      ...positionRows.map((row) => ({
        ticker: row.ticker,
        direction: row.direction,
        status: "OPEN",
        quantity: row.quantity,
        entryPrice: row.entryPrice,
        currentPrice: row.currentPrice,
        pnl: row.pnl,
        pnlPct: row.pnlPct,
        entryAt: row.entryAt,
      })),
      ...history.map((row) => ({
        ticker: row.ticker,
        direction: row.direction,
        status: "CLOSED",
        quantity: row.quantity,
        entryPrice: row.entryPrice,
        exitPrice: Number(row.exitPrice ?? row.entryPrice),
        pnl: Number(row.pnl ?? 0),
        pnlPct: Number(row.pnlPct ?? 0),
        entryAt: row.entryAt,
        exitAt: row.exitAt,
      })),
    ];
    const stats = {
      "Portfolio balance": formatCurrency(portfolioBalance, "USD"),
      "Unrealized P&L": formatCurrency(totalUnrealized, "USD"),
      "Realized P&L": formatCurrency(realizedPnl, "USD"),
      "Win rate": `${formatNumber(winRate, 1)}%`,
      "Open positions": positionRows.length,
      "Closed positions": history.length,
    };
    printPortfolioReport(tradesForPrint, stats);
  }, [history, portfolioBalance, positionRows, realizedPnl, totalUnrealized, winRate]);

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
      setOpenTradePanelVisible(false);
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

  const openReflectionModal = (trade: PositionRow) => {
    setReflectionFollowedPlan(true);
    setReflectionEmotion("NEUTRAL");
    setReflectionLesson("");
    setReflectionTimerSec(REFLECTION_MODAL_DURATION_SEC);
    setReflectionTrade(trade);
  };

  async function closeTradeWithoutReflection(): Promise<void> {
    if (!reflectionTrade || reflectionSubmitting) return;
    await executeCloseTrade(reflectionTrade, null);
  }

  async function closeTradeWithReflection(): Promise<void> {
    if (!reflectionTrade || reflectionSubmitting) return;
    const lesson = reflectionLesson.trim().slice(0, 100);
    await executeCloseTrade(reflectionTrade, {
      followedPlan: reflectionFollowedPlan,
      emotion: reflectionEmotion,
      lesson: lesson.length > 0 ? lesson : null,
    });
  }

  async function executeCloseTrade(
    trade: PositionRow,
    reflection: { followedPlan: boolean; emotion: ReflectionEmotion; lesson: string | null } | null,
  ): Promise<void> {
    setClosingTradeId(trade.id);
    setReflectionSubmitting(true);
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
      if (reflection && closed.id) {
        try {
          const reflectionResult = await createPostTradeReflection({
            userId: USER_ID,
            tradeId: closed.id,
            followedPlan: reflection.followedPlan,
            emotion: reflection.emotion,
            lesson: reflection.lesson,
          });
          if (reflectionResult.aiInsight) {
            setReflectionInsight(reflectionResult.aiInsight);
          }
        } catch (reflectionError) {
          pushToast("error", t("reflection.saveError"), apiErrorMessage(reflectionError));
        }
      }
      await loadData();
      pushToast("success", "Pozycja zamknięta", `${trade.ticker} @ ${formatCurrency(exitPrice, "USD")}`);
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
        pushToast("info", "Zamknięto w trybie mock", `${trade.ticker} • ${formatPercent(pnlPct)}`);
      } else {
        const nextError = apiErrorMessage(e);
        setError(nextError);
        pushToast("error", "Nie udało się zamknąć pozycji", nextError);
      }
    } finally {
      setClosingTradeId(null);
      setReflectionSubmitting(false);
      setReflectionTrade(null);
    }
  }

  async function closeSelectedTrades(): Promise<void> {
    if (selectedOpenTrades.length === 0 || bulkClosing) return;
    setBulkClosing(true);
    try {
      for (const trade of selectedOpenTrades) {
        await executeCloseTrade(trade, null);
      }
      setSelectedTradeIds([]);
    } finally {
      setBulkClosing(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-gradient-to-b from-[#0a0b14] via-[#0f111c]/90 to-[#0a0b14] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-[#1e1b4b]/40 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-[#22d3ee]/12 blur-3xl" />
      </div>
      <div className="relative z-10 mx-auto max-w-7xl space-y-4 px-4 py-6">
        <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#a855f7]/30 to-[#22d3ee]/10 px-4 py-4 shadow-[0_8px_32px_rgba(168,85,247,0.15)] backdrop-blur-md md:px-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-[#22d3ee]">Paper Trading</p>
              <h1 className="text-2xl font-semibold text-white md:text-3xl">Paper Trading</h1>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span className="font-mono text-3xl text-white md:text-4xl">
                  {formatCurrency(portfolioBalance, "USD")}
                </span>
                <span
                  className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={{
                    backgroundColor: portfolioBalance >= 0 ? `${colors.positive}20` : `${colors.negative}20`,
                    color: portfolioBalance >= 0 ? colors.positive : colors.negative,
                  }}
                >
                  P&amp;L {formatPercent(portfolioBalance)}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <ExportButton
                  endpoint="/export/portfolio"
                  userId={USER_ID || undefined}
                  label={t("paperTrading.exportPortfolio", { defaultValue: "Export portfolio" })}
                />
                <button
                  type="button"
                  onClick={onPrintReport}
                  className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition hover:brightness-95"
                  style={{ borderColor: colors.brandDark, color: colors.brandDark, backgroundColor: colors.bgPrimary }}
                >
                  <PrinterIcon className="h-4 w-4" />
                  {t("paperTrading.printReport", { defaultValue: "Print report" })}
                </button>
                <button
                  type="button"
                  onClick={() => setOpenTradePanelVisible((prev) => !prev)}
                  className="rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
                  style={{ background: `linear-gradient(135deg, ${colors.brandDark}, ${colors.brandMedium})` }}
                >
                  {t("paperTrading.openPosition", { defaultValue: "Open position" })}
                </button>
              </div>
              <span
                className="rounded-full border px-2 py-0.5 text-[11px]"
                style={{
                  borderColor: usingMock ? `${colors.brandGold}66` : colors.borderStrong,
                  backgroundColor: usingMock ? `${colors.brandGold}1A` : colors.bgPrimary,
                  color: usingMock ? colors.brandMedium : colors.textSecondary,
                }}
              >
                {usingMock ? "Mock fallback active" : "Live API"}
              </span>
              <span className="text-[11px]" style={{ color: colors.textMuted }}>
                Decision receipts: {receipts.length}
              </span>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label={t("paperTrading.openPositionsStat", { defaultValue: "Open positions" })}
            value={String(portfolio?.openPositions.length ?? positionRows.length)}
          />
          <StatTile label={t("paperTrading.closedStat", { defaultValue: "Closed" })} value={String(closedCount)} />
          <StatTile label="Win rate" value={`${formatNumber(winRate, 1)}%`} tone={winRate >= 50 ? "positive" : "negative"} />
          <StatTile
            label={t("paperTrading.bestTradeStat", { defaultValue: "Best trade" })}
            value={bestTrade ? `${bestTrade.ticker} ${formatPercent(Number(bestTrade.pnlPct ?? 0))}` : "n/a"}
            tone={Number(bestTrade?.pnl ?? 0) >= 0 ? "positive" : "negative"}
          />
        </section>

        {error ? (
          <div
            className="rounded-xl border px-3 py-2 text-sm"
            style={{ borderColor: `${colors.negative}55`, backgroundColor: `${colors.negative}12`, color: colors.negative }}
          >
            {error}
          </div>
        ) : null}
        <FeedbackToastStack toasts={toasts} />
        {reflectionInsight ? (
          <div
            className="rounded-xl border px-3 py-2 text-sm"
            style={{ borderColor: `${colors.brandCyan}66`, backgroundColor: `${colors.brandCyan}14`, color: colors.brandDark }}
          >
            <p className="font-semibold">{t("reflection.aiTitle")}</p>
            <p className="mt-1">{reflectionInsight}</p>
          </div>
        ) : null}

        {openTradePanelVisible ? (
          <section
            className="glass-section rounded-2xl p-4 shadow-sm"
          >
            <form onSubmit={onOpenTrade} className="grid gap-3 md:grid-cols-6">
              <label className="flex flex-col gap-1 text-xs font-medium" style={{ color: colors.textSecondary }}>
                <span>Ticker</span>
                <input
                  className="rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-white text-sm outline-none"
                  style={{ borderColor: colors.borderStrong, color: colors.textPrimary }}
                  value={form.ticker}
                  onChange={(e) => setForm((prev) => ({ ...prev, ticker: e.target.value.toUpperCase() }))}
                  placeholder="AAPL"
                />
              </label>

              <div className="flex flex-col gap-1 text-xs font-medium" style={{ color: colors.textSecondary }}>
                <span>{t("paperTrading.direction")}</span>
                <div className="flex overflow-hidden rounded-lg border" style={{ borderColor: colors.borderStrong }}>
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, direction: "LONG" }))}
                    className="flex-1 px-3 py-2 text-xs font-semibold"
                    style={{
                      backgroundColor: form.direction === "LONG" ? `${colors.positive}18` : colors.bgPrimary,
                      color: form.direction === "LONG" ? colors.positive : colors.textSecondary,
                    }}
                  >
                    {t("paperTrading.long")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, direction: "SHORT" }))}
                    className="flex-1 px-3 py-2 text-xs font-semibold"
                    style={{
                      backgroundColor: form.direction === "SHORT" ? `${colors.negative}18` : colors.bgPrimary,
                      color: form.direction === "SHORT" ? colors.negative : colors.textSecondary,
                    }}
                  >
                    {t("paperTrading.short")}
                  </button>
                </div>
              </div>

              <label className="flex flex-col gap-1 text-xs font-medium" style={{ color: colors.textSecondary }}>
                <span>{t("paperTrading.entryPrice")}</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-white text-sm outline-none"
                  style={{ borderColor: colors.borderStrong, color: colors.textPrimary }}
                  value={form.entryPrice}
                  onChange={(e) => setForm((prev) => ({ ...prev, entryPrice: e.target.value }))}
                  placeholder="100.00"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs font-medium" style={{ color: colors.textSecondary }}>
                <span>{t("premortem.stopLoss")}</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-white text-sm outline-none"
                  style={{ borderColor: colors.borderStrong, color: colors.textPrimary }}
                  value={form.stopLoss}
                  onChange={(e) => setForm((prev) => ({ ...prev, stopLoss: e.target.value }))}
                  placeholder="95.00"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs font-medium" style={{ color: colors.textSecondary }}>
                <span>{t("premortem.takeProfit")}</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-white text-sm outline-none"
                  style={{ borderColor: colors.borderStrong, color: colors.textPrimary }}
                  value={form.takeProfit}
                  onChange={(e) => setForm((prev) => ({ ...prev, takeProfit: e.target.value }))}
                  placeholder="115.00"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs font-medium" style={{ color: colors.textSecondary }}>
                <span>{t("paperTrading.quantity")}</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-white text-sm outline-none"
                  style={{ borderColor: colors.borderStrong, color: colors.textPrimary }}
                  value={form.quantity}
                  onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))}
                  placeholder="1"
                />
              </label>

              <div className="md:col-span-6">
                <button
                  type="submit"
                  disabled={submittingOpen}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
                  style={{ backgroundColor: colors.brandDark }}
                >
                  {submittingOpen ? t("common.loading") : t("paperTrading.openPosition")}
                </button>
              </div>
            </form>
          </section>
        ) : null}

        <section className="glass-section rounded-2xl p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-4 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#22d3ee]">
              {t("paperTrading.openPositionsTitle", { defaultValue: "Open positions" })}
            </h2>
            <span className="text-xs font-medium text-white/60">
              {t("paperTrading.unrealized", { defaultValue: "Unrealized" })} {formatCurrency(totalUnrealized, "USD")}
            </span>
          </div>
          <BulkActions
            totalCount={positionRows.length}
            selectedCount={selectedOpenTrades.length}
            allSelected={allOpenTradesSelected}
            disabled={loadingPortfolio || bulkClosing}
            closeDisabled={bulkClosing || closingTradeId !== null}
            onToggleAll={toggleSelectAllOpenTrades}
            onCloseSelected={closeSelectedTrades}
            onExportSelected={exportSelectedTrades}
            onClearSelection={clearSelectedTrades}
          />
          {loadingPortfolio ? (
            <div className="p-4">
              <TableSkeleton rows={4} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide" style={{ color: colors.textSecondary }}>
                  <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Logo + Symbol</th>
                    <th className="px-3 py-2">Entry price</th>
                    <th className="px-3 py-2">Current price</th>
                    <th className="px-3 py-2">P&amp;L %</th>
                    <th className="px-3 py-2">{t("paperTrading.timeColumn", { defaultValue: "Time" })}</th>
                    <th className="px-3 py-2">{t("paperTrading.actionsColumn", { defaultValue: "Actions" })}</th>
                  </tr>
                </thead>
                <tbody>
                  {positionRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-sm" style={{ color: colors.textMuted }}>
                        {t("paperTrading.noOpenPositions", { defaultValue: "No open positions" })}
                      </td>
                    </tr>
                  ) : (
                    positionRows.map((row) => {
                      const signal = exitSignals[row.id];
                      const freshnessTone = quoteFreshnessTone(row.quoteUpdatedAt, nowMs);
                      const isSelected = selectedTradeIds.includes(row.id);
                      return (
                        <tr key={row.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                          <td className="px-3 py-2">
                            <BulkRowCheckbox
                              checked={isSelected}
                              disabled={bulkClosing || closingTradeId === row.id}
                              label={t("paperTrading.selectTicker", { ticker: row.ticker, defaultValue: `Select ${row.ticker}` })}
                              onChange={(checked) => toggleTradeSelection(row.id, checked)}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold"
                                style={{ backgroundColor: colors.bgTertiary, color: colors.brandDark }}
                              >
                                {row.ticker.slice(0, 2)}
                              </span>
                              <span className="font-semibold" style={{ color: colors.brandDark }}>
                                {row.ticker}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2 font-mono">{formatCurrency(row.entryPrice, "USD")}</td>
                          <td className="px-3 py-2">
                            <div className="font-mono">{formatCurrency(row.currentPrice, "USD")}</div>
                            {row.quoteUpdatedAt ? (
                              <span
                                title={row.quoteUpdatedAt}
                                className={`mt-1 inline-flex rounded px-2 py-0.5 text-[10px] ${quoteFreshnessToneClass(freshnessTone)}`}
                              >
                                {formatQuoteAge(row.quoteUpdatedAt, nowMs)} • {row.quoteSource ?? "—"}
                              </span>
                            ) : null}
                          </td>
                          <td
                            className="px-3 py-2 font-mono font-semibold"
                            style={{ color: row.pnlPct >= 0 ? colors.positive : colors.negative }}
                          >
                            {formatPercent(row.pnlPct)}
                          </td>
                          <td className="px-3 py-2 text-xs" style={{ color: colors.textSecondary }} title={formatDate(row.entryAt, "pl-PL")}>
                            {durationText(row.entryAt, new Date(nowMs).toISOString())}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                disabled={bulkClosing || closingTradeId === row.id}
                                onClick={() => openReflectionModal(row)}
                                className="rounded-md px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                                style={{ backgroundColor: colors.brandDark }}
                              >
                                {closingTradeId === row.id || bulkClosing
                                  ? t("common.loading")
                                  : t("paperTrading.closePosition", { defaultValue: "Close position" })}
                              </button>
                              <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${exitBadgeClass(signal?.action ?? "HOLD")}`}>
                                {signal?.action ?? "HOLD"}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="glass-section rounded-2xl p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-4 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#22d3ee]">
              {t("paperTrading.closedPositionsTitle", { defaultValue: "Closed positions" })}
            </h2>
            <span className="text-xs text-white/60">
              {t("paperTrading.recentCount", { count: Math.min(history.length, 10), defaultValue: `Latest ${Math.min(history.length, 10)}` })}
            </span>
          </div>
          {loadingHistory ? (
            <div className="p-3">
              <TableSkeleton rows={4} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="text-left uppercase tracking-wide" style={{ color: colors.textSecondary }}>
                  <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                    <th className="px-3 py-2">Logo + Symbol</th>
                    <th className="px-3 py-2">Entry price</th>
                    <th className="px-3 py-2">Exit price</th>
                    <th className="px-3 py-2">P&amp;L %</th>
                    <th className="px-3 py-2">Czas</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-5 text-center" style={{ color: colors.textMuted }}>
                        {t("paperTrading.noTradeHistory", { defaultValue: "No trade history" })}
                      </td>
                    </tr>
                  ) : (
                    history.slice(0, 10).map((row) => {
                      const pnlPct = Number(row.pnlPct ?? 0);
                      return (
                        <tr key={row.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                          <td className="px-3 py-1.5">
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold"
                                style={{ backgroundColor: colors.bgTertiary, color: colors.brandDark }}
                              >
                                {row.ticker.slice(0, 2)}
                              </span>
                              <span className="font-semibold" style={{ color: colors.brandDark }}>
                                {row.ticker}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-1.5 font-mono">{formatCurrency(row.entryPrice, "USD")}</td>
                          <td className="px-3 py-1.5 font-mono">{formatCurrency(Number(row.exitPrice ?? row.entryPrice), "USD")}</td>
                          <td className="px-3 py-1.5 font-mono font-semibold" style={{ color: pnlPct >= 0 ? colors.positive : colors.negative }}>
                            {formatPercent(pnlPct)}
                          </td>
                          <td className="px-3 py-1.5" style={{ color: colors.textSecondary }}>
                            {durationText(row.entryAt, row.exitAt)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {reflectionTrade ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(13,13,26,0.45)" }}>
          <div
            className="w-full max-w-lg rounded-2xl border p-5 shadow-[0_28px_72px_rgba(168,85,247,0.28)]"
            style={{ borderColor: colors.borderStrong, backgroundColor: colors.bgPrimary }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold" style={{ color: colors.brandDark }}>
                {t("reflection.title")}
              </h3>
              <span className="rounded-full px-2 py-1 text-xs font-semibold" style={{ backgroundColor: colors.bgTertiary, color: colors.textSecondary }}>
                {t("reflection.timer", { seconds: reflectionTimerSec })}
              </span>
            </div>
            <p className="mb-4 text-sm" style={{ color: colors.textSecondary }}>
              {t("reflection.subtitle", { symbol: reflectionTrade.ticker })}
            </p>

            <div className="space-y-3">
              <div>
                <p className="mb-2 text-sm" style={{ color: colors.textSecondary }}>
                  {t("reflection.followedPlan")}
                </p>
                <div className="flex overflow-hidden rounded-lg border" style={{ borderColor: colors.borderStrong }}>
                  <button
                    type="button"
                    onClick={() => setReflectionFollowedPlan(true)}
                    className="flex-1 px-3 py-2 text-sm font-semibold"
                    style={{
                      backgroundColor: reflectionFollowedPlan ? `${colors.positive}20` : colors.bgPrimary,
                      color: reflectionFollowedPlan ? colors.positive : colors.textSecondary,
                    }}
                  >
                    {t("reflection.yes")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setReflectionFollowedPlan(false)}
                    className="flex-1 px-3 py-2 text-sm font-semibold"
                    style={{
                      backgroundColor: !reflectionFollowedPlan ? `${colors.negative}20` : colors.bgPrimary,
                      color: !reflectionFollowedPlan ? colors.negative : colors.textSecondary,
                    }}
                  >
                    {t("reflection.no")}
                  </button>
                </div>
              </div>

              <label className="flex flex-col gap-1 text-sm">
                <span style={{ color: colors.textSecondary }}>{t("reflection.emotion")}</span>
                <select
                  value={reflectionEmotion}
                  onChange={(e) => setReflectionEmotion(e.target.value as ReflectionEmotion)}
                  className="rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-white outline-none"
                  style={{ borderColor: colors.borderStrong, color: colors.textPrimary }}
                >
                  <option value="FRUSTRATION">{emotionLabel(t, "FRUSTRATION")}</option>
                  <option value="FEAR">{emotionLabel(t, "FEAR")}</option>
                  <option value="CONFIDENT">{emotionLabel(t, "CONFIDENT")}</option>
                  <option value="NEUTRAL">{emotionLabel(t, "NEUTRAL")}</option>
                  <option value="GREEDY">{emotionLabel(t, "GREEDY")}</option>
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span style={{ color: colors.textSecondary }}>{t("reflection.lesson")}</span>
                <textarea
                  value={reflectionLesson}
                  maxLength={100}
                  onChange={(e) => setReflectionLesson(e.target.value.slice(0, 100))}
                  placeholder={t("reflection.lessonPlaceholder")}
                  className="min-h-[88px] rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-white outline-none"
                  style={{ borderColor: colors.borderStrong, color: colors.textPrimary }}
                />
                <span className="text-xs" style={{ color: colors.textMuted }}>
                  {reflectionLesson.length}/100
                </span>
              </label>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => void closeTradeWithReflection()}
                disabled={reflectionSubmitting}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
                style={{ backgroundColor: colors.brandDark }}
              >
                {reflectionSubmitting ? t("common.loading") : t("reflection.saveAndClose")}
              </button>
              <button
                type="button"
                onClick={() => void closeTradeWithoutReflection()}
                disabled={reflectionSubmitting}
                className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-60"
                style={{ borderColor: colors.borderStrong, color: colors.textSecondary }}
              >
                {t("reflection.skip")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {preMortemOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(13,13,26,0.45)" }}>
          <div
            className="w-full max-w-2xl rounded-2xl border p-5 shadow-[0_28px_72px_rgba(168,85,247,0.24)]"
            style={{ borderColor: colors.borderStrong, backgroundColor: colors.bgPrimary }}
          >
            <h3 className="mb-4 text-lg font-bold" style={{ color: colors.brandDark }}>
              🎯 PRE-MORTEM ANALYSIS
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span style={{ color: colors.textSecondary }}>{t("premortem.symbol")}</span>
                <input
                  className="rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-white outline-none"
                  style={{ borderColor: colors.borderStrong, color: colors.textPrimary }}
                  value={preMortemForm.symbol}
                  onChange={(e) => setPreMortemForm((prev) => ({ ...prev, symbol: e.target.value.toUpperCase() }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span style={{ color: colors.textSecondary }}>{t("premortem.quantity")}</span>
                <input
                  type="number"
                  className="rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-white outline-none"
                  style={{ borderColor: colors.borderStrong, color: colors.textPrimary }}
                  value={preMortemForm.quantity}
                  onChange={(e) => setPreMortemForm((prev) => ({ ...prev, quantity: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span style={{ color: colors.textSecondary }}>{t("premortem.entry")}</span>
                <input
                  type="number"
                  className="rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-white outline-none"
                  style={{ borderColor: colors.borderStrong, color: colors.textPrimary }}
                  value={preMortemForm.entry}
                  onChange={(e) => setPreMortemForm((prev) => ({ ...prev, entry: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span style={{ color: colors.textSecondary }}>{t("premortem.stopLoss")}</span>
                <input
                  type="number"
                  className="rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-white outline-none"
                  style={{ borderColor: colors.borderStrong, color: colors.textPrimary }}
                  value={preMortemForm.stopLoss}
                  onChange={(e) => setPreMortemForm((prev) => ({ ...prev, stopLoss: e.target.value }))}
                />
              </label>
              <label className="md:col-span-2 flex flex-col gap-1 text-sm">
                <span style={{ color: colors.textSecondary }}>{t("premortem.takeProfit")}</span>
                <input
                  type="number"
                  className="rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-white outline-none"
                  style={{ borderColor: colors.borderStrong, color: colors.textPrimary }}
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
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
                style={{ backgroundColor: colors.brandDark }}
              >
                {runningPreMortem ? t("common.loading") : t("premortem.runButton")}
              </button>
            </div>

            {preMortemResult ? (
              <div className="mt-4 rounded-lg border p-4" style={{ borderColor: `${colors.negative}4D`, backgroundColor: `${colors.negative}12` }}>
                <p className="text-sm font-semibold" style={{ color: colors.negative }}>
                  {t("premortem.lossScenario")}
                </p>
                <p className="mt-1 text-sm" style={{ color: colors.textPrimary }}>
                  {preMortemResult.scenario}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-sm">
                  <span className="rounded px-2 py-1 font-semibold" style={{ backgroundColor: `${colors.brandGold}24`, color: colors.brandMedium }}>
                    {preMortemResult.probability}% chance
                  </span>
                  <span className="rounded px-2 py-1" style={{ backgroundColor: colors.bgTertiary, color: colors.textPrimary }}>
                    {Math.abs(preMortemResult.maxLoss).toFixed(2)} PLN (~{(Math.abs(preMortemResult.maxLoss) / PLN_PER_USD).toFixed(2)} USD)
                  </span>
                  <span className="rounded px-2 py-1" style={{ backgroundColor: colors.bgTertiary, color: colors.textSecondary }}>
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
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
                style={{ backgroundColor: colors.positive }}
              >
                {t("premortem.proceed")}
              </button>
              <button
                type="button"
                onClick={() => setPreMortemOpen(false)}
                className="rounded-lg border px-4 py-2 text-sm font-semibold"
                style={{ borderColor: colors.borderStrong, color: colors.textSecondary }}
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

function StatTile(props: { label: string; value: string; tone?: "default" | "positive" | "negative" }) {
  const tone = props.tone ?? "default";
  const valueColor =
    tone === "positive" ? "text-emerald-400" : tone === "negative" ? "text-red-400" : "text-white";
  return (
    <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-[#9333ea]/25 px-3 py-2 shadow-[0_8px_24px_rgba(168,85,247,0.12)] backdrop-blur-md">
      <div className="text-[11px] uppercase tracking-[0.1em] text-white/50">{props.label}</div>
      <div className={`mt-1 font-mono text-xl font-semibold ${valueColor}`}>{props.value}</div>
    </div>
  );
}

function TableSkeleton(props: { rows: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: props.rows }).map((_, idx) => (
        <div
          key={`sk-${idx}`}
          className="animate-pulse rounded border p-3"
          style={{ borderColor: colors.border, backgroundColor: colors.bgSecondary }}
        >
          <div className="h-4 w-1/4 rounded" style={{ backgroundColor: colors.borderStrong }} />
          <div className="mt-2 h-4 w-full rounded" style={{ backgroundColor: colors.border }} />
        </div>
      ))}
    </div>
  );
}
