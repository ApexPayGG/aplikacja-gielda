import { useTranslation } from "react-i18next";
import { TerminalBadge } from "../terminal/TerminalBadge";
import { TERMINAL_ACCENT_RAIL_CYAN, TERMINAL_SIGNAL_PANEL } from "../terminal/terminalStyles";
import { CONFIDENCE_TIER_HINTS, MARKET_SIGNALS_READONLY_FOOTNOTE } from "./marketSignals.types";
import { cn } from "../terminal/cn";

type Props = {
  ticker: string;
  lookbackDays: number;
  compact?: boolean;
};

export function MarketSignalsEmptyState({ ticker, lookbackDays, compact = false }: Props) {
  const { t } = useTranslation();

  const diagnostics = [
    {
      label: t("company.signals.scan.lookback", { defaultValue: "Lookback" }),
      value: t("company.signals.scan.lookbackValue", {
        days: lookbackDays,
        defaultValue: "{{days}} days",
      }),
    },
    {
      label: t("company.signals.scan.confidence", { defaultValue: "Confidence" }),
      value: t("company.signals.scan.confidenceValue", {
        high: CONFIDENCE_TIER_HINTS.high,
        medium: CONFIDENCE_TIER_HINTS.medium,
        low: CONFIDENCE_TIER_HINTS.low,
        defaultValue: "High >= {{high}} | Medium {{medium}} | Low {{low}}",
      }),
    },
    {
      label: t("company.signals.scan.mode", { defaultValue: "Mode" }),
      value: t("company.signals.scan.modeValue", {
        defaultValue: "Read-only provider signals",
      }),
    },
    {
      label: t("company.signals.scan.ticker", { defaultValue: "Ticker" }),
      value: ticker,
    },
  ];

  return (
    <div className={cn(TERMINAL_SIGNAL_PANEL, TERMINAL_ACCENT_RAIL_CYAN, "pl-3 sm:pl-3.5")}>
      <div className={`flex gap-3 sm:gap-4 ${compact ? "items-center" : "items-start"}`}>
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-terminal-cyan/25 bg-terminal-cyan/10 font-mono text-sm text-terminal-cyan sm:h-11 sm:w-11"
          aria-hidden
        >
          SCAN
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-terminal-cyan">
            {t("company.signals.scan.eyebrow", { defaultValue: "Signal scan complete" })}
          </p>
          <h3 className="mt-1 text-sm font-semibold text-terminal-text sm:text-base">
            {t("company.signals.scan.title", {
              defaultValue: "No institutional signals detected for this lookback window.",
            })}
          </h3>
          <p className="mt-1.5 text-xs leading-relaxed text-terminal-textSecondary sm:text-sm">
            {t("company.signals.scan.body", {
              defaultValue:
                "This means no stored provider signal currently matches the ticker, confidence threshold, and {{days}}-day lookback.",
              days: lookbackDays,
            })}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {diagnostics.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-2 rounded-md border border-terminal-borderMuted/80 bg-terminal-bgAlt/40 px-2.5 py-1.5"
          >
            <span className="font-mono text-[9px] uppercase tracking-wide text-terminal-textMuted">{row.label}</span>
            <TerminalBadge variant="default" className="max-w-[65%] truncate font-mono text-[10px]">
              {row.value}
            </TerminalBadge>
          </div>
        ))}
      </div>

      <footer className="mt-3 border-t border-terminal-borderMuted pt-2.5">
        <p className="text-[10px] leading-relaxed text-terminal-textMuted">{MARKET_SIGNALS_READONLY_FOOTNOTE}</p>
      </footer>
    </div>
  );
}
