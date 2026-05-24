import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { formatLocaleDate, formatLocaleDateTime } from "../../utils/formatters";
import { GLASS_SIGNAL_CARD } from "../behavioral-coach/glassStyles";
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
};

function confidenceBadgeClass(tier: ReturnType<typeof getConfidenceTier>): string {
  if (tier === "high") return "border-[#22d3ee]/35 bg-[#22d3ee]/12 text-[#67e8f9]";
  if (tier === "medium") return "border-[#f59e0b]/35 bg-[#f59e0b]/12 text-[#fcd34d]";
  return "border-white/15 bg-white/[0.06] text-[#94a3b8]";
}

function signalTypeBadgeClass(signalType: MarketSignal["signalType"]): string {
  if (signalType === "WHALE_ACCUMULATION") return "border-[#a855f7]/40 bg-[#a855f7]/15 text-[#e9d5ff]";
  if (signalType === "INSIDER_ACTIVITY") return "border-[#4ade80]/30 bg-[#4ade80]/10 text-[#86efac]";
  if (signalType === "OPTIONS_FLOW") return "border-[#22d3ee]/30 bg-[#22d3ee]/10 text-[#67e8f9]";
  if (signalType === "DARK_POOL") return "border-[#6366f1]/35 bg-[#6366f1]/12 text-[#c7d2fe]";
  if (signalType === "SEC_FILING") return "border-[#f59e0b]/30 bg-[#f59e0b]/10 text-[#fcd34d]";
  if (signalType === "ANALYST_REVISION") return "border-[#f472b6]/30 bg-[#f472b6]/10 text-[#fbcfe8]";
  return "border-white/12 bg-white/[0.05] text-[#cbd5e1]";
}

export function MarketSignalCard({ signal, compact = false, locale = "en-US" }: Props) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const tier = getConfidenceTier(signal.confidenceScore);
  const tierLabel = getConfidenceTierLabel(tier);
  const payloadLines = summarizeRawPayload(signal.rawPayload);
  const hasDetails = payloadLines.length > 0;
  const eventDateLabel = compact
    ? formatLocaleDate(signal.eventTime, locale)
    : formatLocaleDateTime(signal.eventTime, locale);

  return (
    <article className={`${GLASS_SIGNAL_CARD} ${compact ? "p-4" : "p-5"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span
            className={`inline-flex shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${signalTypeBadgeClass(signal.signalType)}`}
          >
            {getSignalTypeLabel(signal.signalType)}
          </span>
          <span
            className={`inline-flex shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${confidenceBadgeClass(tier)}`}
            title={`${tierLabel} confidence (${CONFIDENCE_TIER_HINTS[tier]})`}
          >
            {signal.confidenceScore}% · {tierLabel}
          </span>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#64748b]">Event</p>
          <time className="text-xs text-[#94a3b8]" dateTime={signal.eventTime}>
            {eventDateLabel}
          </time>
        </div>
      </div>

      <h4 className={`mt-3 font-semibold leading-snug text-white ${compact ? "text-sm" : "text-base"}`}>
        {signal.title}
      </h4>

      {signal.summary && !compact ? (
        <p className="mt-2 text-sm leading-relaxed text-[#94a3b8]">{signal.summary}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#64748b]">
        <span>
          Source: <span className="text-[#94a3b8]">{getSourceLabel(signal.source)}</span>
        </span>
      </div>

      {hasDetails && !compact ? (
        <div className="mt-3 border-t border-white/[0.06] pt-3">
          <button
            type="button"
            onClick={() => setDetailsOpen((open) => !open)}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#22d3ee] transition hover:text-[#67e8f9]"
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
            <dl className="mt-2 space-y-1.5 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2 text-xs text-[#94a3b8]">
              {payloadLines.map((line) => {
                const separatorIndex = line.indexOf(": ");
                const label = separatorIndex >= 0 ? line.slice(0, separatorIndex) : line;
                const value = separatorIndex >= 0 ? line.slice(separatorIndex + 2) : "";
                return (
                  <div key={line} className="flex flex-wrap gap-x-1.5 leading-relaxed">
                    <dt className="font-medium text-[#cbd5e1]">{label}</dt>
                    {value ? <dd className="text-[#94a3b8]">{value}</dd> : null}
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
