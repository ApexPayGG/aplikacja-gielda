import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useId, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Company } from "../services/api";
import { InvestmentDisclaimer } from "./InvestmentDisclaimer";
import { buildAIBriefInsight, sentimentLabelText } from "../utils/aiBriefContent";
import { CompanyLogo } from "./CompanyLogo";
import {
  TERMINAL_BADGE,
  TERMINAL_BUTTON_PRIMARY,
  TERMINAL_DRAWER_PANEL,
  TERMINAL_ICON_BUTTON,
  TERMINAL_PANEL,
  TERMINAL_SECTION_TITLE,
  TERMINAL_SHELL_OVERLAY,
  TERMINAL_TEXT_MUTED,
} from "./terminal/terminalStyles";

type Props = {
  company: Company | null;
  open: boolean;
  onClose: () => void;
};

function SentimentGauge({
  score,
  label,
  bearishLabel,
  bullishLabel,
}: {
  score: number;
  label: string;
  bearishLabel: string;
  bullishLabel: string;
}) {
  const clamped = Math.max(0, Math.min(100, score));

  return (
    <div className="space-y-3">
      <div className="relative h-3 overflow-hidden rounded-full border border-terminal-borderMuted bg-terminal-panelSecondary">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-terminal-negative/80 via-terminal-warning/70 to-terminal-cyan"
          style={{ width: "100%" }}
          aria-hidden
        />
        <div
          className="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border-2 border-terminal-text bg-terminal-panel shadow-[0_0_12px_rgba(34,211,238,0.45)]"
          style={{ left: `calc(${clamped}% - 10px)` }}
          aria-hidden
        />
      </div>
      <div className="flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-center gap-1 text-terminal-negative">
          <ArrowTrendingDownIcon className="h-3.5 w-3.5" aria-hidden />
          {bearishLabel}
        </span>
        <span className={`${TERMINAL_BADGE} border-terminal-cyan/30 text-terminal-cyan`}>
          {label} · {clamped}%
        </span>
        <span className="flex items-center gap-1 text-terminal-cyan">
          {bullishLabel}
          <ArrowTrendingUpIcon className="h-3.5 w-3.5" aria-hidden />
        </span>
      </div>
    </div>
  );
}

export function AIBriefDrawer({ company, open, onClose }: Props) {
  const { t } = useTranslation();
  const panelId = useId();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const insight = useMemo(() => {
    if (!company) return null;
    return buildAIBriefInsight(company.symbol, company.sector, t);
  }, [company, t]);

  const premiumHref = company ? `/company/${encodeURIComponent(company.symbol)}/premium` : "/pricing";

  useEffect(() => {
    if (!open) return undefined;

    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      previouslyFocusedRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open || !company || !insight) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[65] flex flex-col justify-end md:flex-row md:justify-end" role="presentation">
      <button
        type="button"
        className={`absolute inset-0 ${TERMINAL_SHELL_OVERLAY} opacity-100`}
        aria-label={t("aiBriefDrawer.closeOverlay", { defaultValue: "Close AI Brief panel" })}
        onClick={onClose}
      />

      <aside
        id={panelId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${panelId}-title`}
        className={TERMINAL_DRAWER_PANEL}
      >
        <div className="mx-auto mt-2 h-1 w-12 shrink-0 rounded-full bg-terminal-borderMuted md:hidden" aria-hidden />

        <header className="relative shrink-0 border-b border-terminal-border px-5 pb-4 pt-3 sm:px-6 sm:pt-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <CompanyLogo symbol={company.symbol} logoUrl={company.logoUrl} size="md" shape="circle" />
              <div className="min-w-0">
                <p id={`${panelId}-title`} className="truncate text-lg font-bold text-terminal-text">
                  {company.name}
                </p>
                <p className="font-mono text-sm font-semibold text-terminal-cyan">{company.symbol}</p>
                <p className="mt-0.5 truncate text-xs text-terminal-textMuted">{company.sector}</p>
              </div>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className={`${TERMINAL_ICON_BUTTON} h-11 w-11 shrink-0 rounded-full`}
              aria-label={t("aiBriefDrawer.close", { defaultValue: "Close AI Brief" })}
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <span className={`inline-flex items-center gap-1.5 ${TERMINAL_BADGE} border-terminal-cyan/25 text-terminal-cyan`}>
            <SparklesIcon className="h-3.5 w-3.5" aria-hidden />
            {t("aiBriefDrawer.poweredBy", { defaultValue: "Analysis powered by Claude 3.5 Sonnet" })}
          </span>
        </header>

        <div className="relative flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
          <section className={`${TERMINAL_PANEL} p-4`}>
            <h2 className={TERMINAL_SECTION_TITLE}>
              {t("aiBriefDrawer.morningTitle", { defaultValue: "Morning quick brief" })}
            </h2>
            <ul className="mt-3 space-y-3 text-sm leading-relaxed text-terminal-textSecondary">
              {insight.morningBullets.map((bullet) => (
                <li key={bullet.slice(0, 48)} className="flex gap-2.5">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-terminal-cyan" aria-hidden />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className={`${TERMINAL_PANEL} p-4`}>
            <h2 className={TERMINAL_SECTION_TITLE}>
              {t("aiBriefDrawer.sectorSentiment", { defaultValue: "Sector sentiment" })}
            </h2>
            <p className={`mt-1 ${TERMINAL_TEXT_MUTED}`}>
              {t("aiBriefDrawer.sectorSentimentHint", {
                defaultValue: "Based on aggregated news and macro signals in the {{sector}} sector.",
                sector: company.sector,
              })}
            </p>
            <div className="mt-4">
              <SentimentGauge
                score={insight.sentiment.score}
                label={sentimentLabelText(insight.sentiment.label, t)}
                bearishLabel={t("aiBriefDrawer.bearish", { defaultValue: "Bearish" })}
                bullishLabel={t("aiBriefDrawer.bullish", { defaultValue: "Bullish" })}
              />
            </div>
          </section>

          <section className="rounded-lg border border-terminal-warning/30 bg-terminal-warning/10 p-4">
            <div className="flex items-center gap-2">
              <ExclamationTriangleIcon className="h-5 w-5 text-terminal-warning" aria-hidden />
              <h2 className={`${TERMINAL_SECTION_TITLE} text-terminal-warning`}>
                {t("aiBriefDrawer.behavioralWarning", { defaultValue: "Behavioral warning" })}
              </h2>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-terminal-textSecondary">
              <span className="font-semibold text-terminal-warning">{t("aiBriefDrawer.coachPrefix", { defaultValue: "AI Coach:" })} </span>
              {insight.behavioralWarning}
            </p>
          </section>
        </div>

        <footer className="relative shrink-0 space-y-4 border-t border-terminal-border p-5 sm:px-6">
          <InvestmentDisclaimer variant="drawer" />
          <Link
            to={premiumHref}
            onClick={onClose}
            className={`block text-center ${TERMINAL_BUTTON_PRIMARY} w-full rounded-lg px-4 py-3.5 text-sm leading-snug`}
          >
            <span className="text-terminal-buttonText/80">
              {t("aiBriefDrawer.alertsPrompt", {
                defaultValue: "Want daily SMS/Push alerts for this company?",
              })}{" "}
            </span>
            <span className="font-semibold">
              {t("aiBriefDrawer.unlockAlerts", { defaultValue: "Unlock StockAI Pro alerts" })}
            </span>
          </Link>
        </footer>
      </aside>
    </div>
  );
}
