import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getMarketSignals } from "../../services/api";
import { apiErrorMessage } from "../../utils/apiErrorMessage";
import { TERMINAL_SIGNAL_PANEL } from "../terminal/terminalStyles";
import { MarketSignalCard } from "./MarketSignalCard";
import { MarketSignalsEmptyState } from "./MarketSignalsEmptyState";
import { MarketSignalsSkeleton } from "./MarketSignalsSkeleton";
import { MarketSignalsFootnote } from "./MarketSignalsFootnote";
import { MarketSignalsSummary } from "./MarketSignalsSummary";
import type { MarketSignalsResponse } from "./marketSignals.types";

export type MarketSignalsPanelProps = {
  ticker: string;
  lookbackDays?: number;
  compact?: boolean;
};

export function MarketSignalsPanel({ ticker, lookbackDays = 30, compact = false }: MarketSignalsPanelProps) {
  const { i18n } = useTranslation();
  const [data, setData] = useState<MarketSignalsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const normalizedTicker = ticker.trim().toUpperCase();
  const locale = i18n.resolvedLanguage || "en-US";

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await getMarketSignals(normalizedTicker, { lookbackDays });
        if (!cancelled) setData(response);
      } catch (e) {
        if (!cancelled) setError(apiErrorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (!normalizedTicker) {
      setLoading(false);
      setData(null);
      setError("Ticker is required");
      return;
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [normalizedTicker, lookbackDays]);

  if (loading) {
    return <MarketSignalsSkeleton compact={compact} />;
  }

  if (error) {
    return (
      <div className={TERMINAL_SIGNAL_PANEL}>
        <div className="rounded-lg border border-terminal-negative/30 bg-terminal-negative/10 px-4 py-3">
          <p className="text-sm font-medium text-terminal-negative">Unable to load market signals</p>
          <p className="mt-1 text-xs text-terminal-textSecondary">{error}</p>
        </div>
      </div>
    );
  }

  if (!data || data.signals.length === 0) {
    return <MarketSignalsEmptyState ticker={normalizedTicker} lookbackDays={lookbackDays} compact={compact} />;
  }

  const visibleSignals = compact ? data.signals.slice(0, 3) : data.signals;

  return (
    <div className={TERMINAL_SIGNAL_PANEL}>
      <header className={compact ? "mb-3" : "mb-4"}>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-terminal-text">Institutional signals</h3>
            {!compact ? (
              <p className="mt-1 text-xs text-terminal-textSecondary">
                Read-only flow intelligence for {normalizedTicker} · last {data.lookbackDays} days
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <MarketSignalsSummary summary={data.summary} compact={compact} />

      <div className={`space-y-3 ${compact ? "mt-3" : "mt-4"}`}>
        {visibleSignals.map((signal) => (
          <MarketSignalCard key={signal.id} signal={signal} compact={compact} locale={locale} />
        ))}
      </div>

      {compact && data.signals.length > visibleSignals.length ? (
        <p className="mt-3 text-xs font-medium text-terminal-textMuted">
          +{data.signals.length - visibleSignals.length} more signals
        </p>
      ) : null}

      <MarketSignalsFootnote compact={compact} showConfidenceLegend={!compact} />
    </div>
  );
}
