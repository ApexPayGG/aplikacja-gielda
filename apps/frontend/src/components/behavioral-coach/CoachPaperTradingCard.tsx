import { ArrowTrendingUpIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { EmotionJournalState } from "../../utils/behavioralCoachData";
import type { CoachPaperTrade } from "../../utils/coachPaperTrading";
import { PAPER_SYMBOL_PRESETS } from "../../utils/coachPaperTrading";
import { mockQuoteFromSymbol } from "../../utils/companyCardDisplay";
import { GLASS_BTN_PRIMARY, GLASS_SECTION, GLASS_SECTION_TITLE } from "./glassStyles";
import { TERMINAL_BUTTON_SECONDARY, TERMINAL_INPUT, TERMINAL_TRADE_CARD } from "../terminal/terminalStyles";

type Props = {
  emotion: EmotionJournalState | null;
  emotionAcknowledged: boolean;
  openTrades: CoachPaperTrade[];
  closedTrades: CoachPaperTrade[];
  onOpenTrade: (input: {
    symbol: string;
    entryPrice: number;
    quantity: number;
    emotion: EmotionJournalState;
  }) => { ok: boolean; error?: string };
  onCloseTrade: (input: { tradeId: string; closePrice: number }) => { ok: boolean; error?: string };
};

export function CoachPaperTradingCard({
  emotion,
  emotionAcknowledged,
  openTrades,
  closedTrades,
  onOpenTrade,
  onCloseTrade,
}: Props) {
  const { t } = useTranslation();
  const [symbol, setSymbol] = useState<string>(PAPER_SYMBOL_PRESETS[0]);
  const [quantity, setQuantity] = useState("1");
  const [entryPrice, setEntryPrice] = useState("");
  const [closePrices, setClosePrices] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<string | null>(null);

  const fillMockPrice = () => {
    const mock = mockQuoteFromSymbol(symbol);
    setEntryPrice(String(mock.price));
  };

  const handleBuy = () => {
    if (!emotion || !emotionAcknowledged) {
      setFeedback(
        t("coach.paper.selectEmotionFirst", {
          defaultValue: "Select an emotion above before placing a paper order.",
        }),
      );
      return;
    }
    const qty = Number(quantity);
    const entry = Number(entryPrice);
    const result = onOpenTrade({ symbol, entryPrice: entry, quantity: qty, emotion });
    if (!result.ok) {
      setFeedback(result.error ?? t("coach.paper.openFailed", { defaultValue: "Could not open the position." }));
      return;
    }
    setFeedback(
      t("coach.paper.opened", {
        symbol: symbol.toUpperCase(),
        emotion,
        defaultValue: "Opened paper BUY {{symbol}} · emotion: {{emotion}}",
      }),
    );
    setClosePrices({});
  };

  const handleClose = (tradeId: string) => {
    const close = Number(closePrices[tradeId]);
    const result = onCloseTrade({ tradeId, closePrice: close });
    if (!result.ok) {
      setFeedback(result.error ?? t("coach.paper.closeFailed", { defaultValue: "Could not close the position." }));
      return;
    }
    setFeedback(t("coach.paper.closedRadar", { defaultValue: "Position closed — psyche radar updated." }));
  };

  return (
    <section className={GLASS_SECTION}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={GLASS_SECTION_TITLE}>
            {t("coach.paper.title", { defaultValue: "Quick paper trading" })}
          </h2>
          <p className="mt-1 text-sm text-terminal-textMuted">
            {t("coach.paper.subtitle", {
              defaultValue: "Simulated orders linked to your emotion journal and psyche radar.",
            })}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-terminal-borderMuted bg-terminal-panelSecondary px-2.5 py-1 text-[11px] text-terminal-textMuted">
          <ArrowTrendingUpIcon className="h-3.5 w-3.5 text-terminal-cyan" aria-hidden />
          {t("coach.paper.openCount", {
            count: openTrades.length,
            defaultValue: "{{count}} open",
          })}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-xs font-semibold uppercase tracking-wide text-terminal-textMuted">
          {t("coach.paper.symbol", { defaultValue: "Ticker" })}
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className={`mt-1 w-full ${TERMINAL_INPUT}`}
          >
            {PAPER_SYMBOL_PRESETS.map((preset) => (
              <option key={preset} value={preset} className="bg-[#0f111c]">
                {preset}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-terminal-textMuted">
          {t("coach.paper.quantity", { defaultValue: "Quantity" })}
          <input
            type="number"
            min={0.0001}
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className={`mt-1 w-full ${TERMINAL_INPUT}`}
          />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-terminal-textMuted">
          {t("coach.paper.entryPrice", { defaultValue: "Entry price" })}
          <input
            type="number"
            min={0.01}
            step="any"
            value={entryPrice}
            onChange={(e) => setEntryPrice(e.target.value)}
            placeholder="0.00"
            className={`mt-1 w-full ${TERMINAL_INPUT}`}
          />
        </label>
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={fillMockPrice}
            className={`w-full ${TERMINAL_BUTTON_SECONDARY}`}
          >
            {t("coach.paper.mockPrice", { defaultValue: "Mock price" })}
          </button>
        </div>
      </div>

      <button
        type="button"
        disabled={!emotionAcknowledged || !emotion}
        onClick={handleBuy}
        className={`mt-4 inline-flex w-full sm:w-auto ${GLASS_BTN_PRIMARY} disabled:cursor-not-allowed disabled:opacity-45`}
      >
        {t("coach.paper.buy", { defaultValue: "Buy (Paper BUY)" })}
      </button>

      <p className="mt-2 text-[11px] leading-relaxed text-terminal-textMuted">
        {t("coach.paper.disclaimer", {
          defaultValue:
            "You are testing strategy manually. Automatic sync with a live broker account (PRO+) is locked.",
        })}
      </p>

      {feedback ? <p className="mt-3 text-xs text-terminal-cyan">{feedback}</p> : null}

      {openTrades.length > 0 ? (
        <ul className="mt-5 space-y-3 border-t border-terminal-border pt-4">
          {openTrades.map((trade) => (
            <li key={trade.id} className={TERMINAL_TRADE_CARD}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-mono font-semibold text-terminal-cyan">{trade.symbol}</span>
                <span className="text-terminal-textMuted">
                  {trade.quantity} @ {trade.entryPrice.toFixed(2)} · {trade.emotionAtEntry}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  type="number"
                  min={0.01}
                  step="any"
                  value={closePrices[trade.id] ?? ""}
                  onChange={(e) => setClosePrices((prev) => ({ ...prev, [trade.id]: e.target.value }))}
                  placeholder={t("coach.paper.closePrice", { defaultValue: "Close price" })}
                  className={`min-w-[10rem] flex-1 ${TERMINAL_INPUT}`}
                />
                <button
                  type="button"
                  onClick={() => handleClose(trade.id)}
                  className="rounded-lg border border-terminal-positive/30 bg-terminal-positive/10 px-3 py-2 text-xs font-semibold text-terminal-positive transition hover:bg-terminal-positive/20"
                >
                  {t("coach.paper.closeSell", { defaultValue: "Close (SELL)" })}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {closedTrades.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {closedTrades.map((trade) => (
            <li key={trade.id} className={`flex flex-wrap justify-between gap-2 ${TERMINAL_TRADE_CARD} text-xs text-terminal-textSecondary`}>
              <span>
                {t("coach.paper.closedPrefix", { symbol: trade.symbol, defaultValue: "{{symbol}} closed · P/L" })}{" "}
                <span className={trade.profitLoss && trade.profitLoss >= 0 ? "text-terminal-positive" : "text-terminal-negative"}>
                  {trade.profitLoss !== null ? trade.profitLoss.toFixed(2) : "—"}
                </span>
              </span>
              <span>{trade.emotionAtEntry}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
