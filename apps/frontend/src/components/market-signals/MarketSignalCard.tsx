import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { formatLocaleDate, formatLocaleDateTime } from "../../utils/formatters";
import {
  TERMINAL_LINK_ACCENT,
  TERMINAL_SIGNAL_BADGE,
  TERMINAL_SIGNAL_CARD,
  TERMINAL_SIGNAL_INNER,
} from "../terminal/terminalStyles";
import {
  CONFIDENCE_TIER_HINTS,
  getConfidenceTier,
  getConfidenceTierLabel,
  getSignalTypeLabel,
  getSourceLabel,
  summarizeRawPayload,
  type MarketSignal,
} from "./marketSignals.types";

type Props = {
  signal: MarketSignal;
  compact?: boolean;
  locale?: string;
  selected?: boolean;
};

function confidenceBadgeClass(tier: ReturnType<typeof getConfidenceTier>): string {
  if (tier === "high") return "border-terminal-cyan/35 bg-terminal-cyan/12 text-terminal-cyan";
  if (tier === "medium") return "border-terminal-warning/35 bg-terminal-warning/12 text-terminal-warning";
  return "border-terminal-borderMuted bg-terminal-panelSecondary text-terminal-textMuted";
}

function signalTypeBadgeClass(signalType: MarketSignal["signalType"]): string {
  if (signalType === "WHALE_ACCUMULATION") return "border-terminal-cyan/40 bg-terminal-cyan/15 text-terminal-cyan";
  if (signalType === "INSIDER_ACTIVITY") return "border-terminal-positive/30 bg-terminal-positive/10 text-terminal-positive";
  if (signalType === "OPTIONS_FLOW") return "border-terminal-cyan/30 bg-terminal-cyan/10 text-terminal-cyanStrong";
  if (signalType === "DARK_POOL") return "border-terminal-cyanDark/35 bg-terminal-panelSecondary text-terminal-textSecondary";
  if (signalType === "SEC_FILING") return "border-terminal-warning/30 bg-terminal-warning/10 text-terminal-warning";
  if (signalType === "ANALYST_REVISION") return "border-terminal-borderMuted bg-terminal-panelSecondary text-terminal-text";
  return "border-terminal-borderMuted bg-terminal-panelSecondary/80 text-terminal-textSecondary";
}

export function MarketSignalCard({ signal, compact = false, locale = "en-US", selected = false }: Props) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const tier = getConfidenceTier(signal.confidenceScore);
  const tierLabel = getConfidenceTierLabel(tier);
  const payloadLines = summarizeRawPayload(signal.rawPayload);
  const hasDetails = payloadLines.length > 0;
  const eventDateLabel = compact
    ? formatLocaleDate(signal.eventTime, locale)
    : formatLocaleDateTime(signal.eventTime, locale);

  return (
    <article
      className={`${TERMINAL_SIGNAL_CARD} ${compact ? "!p-4" : ""} ${selected ? "border-terminal-cyan/45 shadow-terminal-glow" : "hover:border-terminal-cyan/30"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span className={`${TERMINAL_SIGNAL_BADGE} ${signalTypeBadgeClass(signal.signalType)}`}>
            {getSignalTypeLabel(signal.signalType)}
          </span>
          <span
            className={`${TERMINAL_SIGNAL_BADGE} ${confidenceBadgeClass(tier)}`}
            title={`${tierLabel} confidence (${CONFIDENCE_TIER_HINTS[tier]})`}
          >
            {signal.confidenceScore}% · {tierLabel}
          </span>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-terminal-textMuted">Event</p>
          <time className="text-xs text-terminal-textSecondary" dateTime={signal.eventTime}>
            {eventDateLabel}
          </time>
        </div>
      </div>

      <h4 className={`mt-3 font-semibold leading-snug text-terminal-text ${compact ? "text-sm" : "text-base"}`}>
        {signal.title}
      </h4>

      {signal.summary && !compact ? (
        <p className="mt-2 text-sm leading-relaxed text-terminal-textSecondary">{signal.summary}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-terminal-textMuted">
        <span>
          Source: <span className="text-terminal-textSecondary">{getSourceLabel(signal.source)}</span>
        </span>
      </div>

      {hasDetails && !compact ? (
        <div className="mt-3 border-t border-terminal-borderMuted pt-3">
          <button
            type="button"
            onClick={() => setDetailsOpen((open) => !open)}
            className={`inline-flex items-center gap-1 text-xs font-medium ${TERMINAL_LINK_ACCENT} no-underline`}
            aria-expanded={detailsOpen}
          >
            {detailsOpen ? (
              <>
                Hide details
                <ChevronUpIcon className="h-3.5 w-3.5" aria-hidden />
              </>
            ) : (
              <>
                Show details
                <ChevronDownIcon className="h-3.5 w-3.5" aria-hidden />
              </>
            )}
          </button>
          {detailsOpen ? (
            <dl className={`mt-2 space-y-1.5 px-3 py-2 text-xs text-terminal-textSecondary ${TERMINAL_SIGNAL_INNER}`}>
              {payloadLines.map((line) => {
                const separatorIndex = line.indexOf(": ");
                const label = separatorIndex >= 0 ? line.slice(0, separatorIndex) : line;
                const value = separatorIndex >= 0 ? line.slice(separatorIndex + 2) : "";
                return (
                  <div key={line} className="flex flex-wrap gap-x-1.5 leading-relaxed">
                    <dt className="font-medium text-terminal-text">{label}</dt>
                    {value ? <dd>{value}</dd> : null}
                  </div>
                );
              })}
            </dl>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
