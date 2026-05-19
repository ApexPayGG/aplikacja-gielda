import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useId, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import type { Company } from "../services/api";
import { InvestmentDisclaimer } from "./InvestmentDisclaimer";
import { buildAIBriefInsight } from "../utils/aiBriefContent";
import { getSector3dIconPath } from "../utils/sectorIcon3d";

type Props = {
  company: Company | null;
  open: boolean;
  onClose: () => void;
};

function SentimentGauge({ score, label }: { score: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, score));

  return (
    <div className="space-y-3">
      <div className="relative h-3 overflow-hidden rounded-full border border-white/10 bg-[#2D0A6B]/20 backdrop-blur-sm">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-red-500/80 via-amber-400/70 to-[#00C9D4]"
          style={{ width: "100%" }}
          aria-hidden
        />
        <div
          className="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border-2 border-white bg-[#2D0A6B] shadow-[0_0_12px_rgba(0,201,212,0.55)]"
          style={{ left: `calc(${clamped}% - 10px)` }}
          aria-hidden
        />
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-red-300/90">
          <ArrowTrendingDownIcon className="h-3.5 w-3.5" aria-hidden />
          Niedźwiedzi
        </span>
        <span className="rounded-full border border-[#00C9D4]/30 bg-[#00C9D4]/10 px-2.5 py-0.5 font-semibold text-[#00C9D4]">
          {label} · {clamped}%
        </span>
        <span className="flex items-center gap-1 text-[#00C9D4]">
          Byczy
          <ArrowTrendingUpIcon className="h-3.5 w-3.5" aria-hidden />
        </span>
      </div>
    </div>
  );
}

export function AIBriefDrawer({ company, open, onClose }: Props) {
  const panelId = useId();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const insight = useMemo(() => {
    if (!company) return null;
    return buildAIBriefInsight(company.symbol, company.sector);
  }, [company]);

  const sectorIconSrc = company ? getSector3dIconPath(company.sector, company.symbol) : "";
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
    <div className="fixed inset-0 z-[65] flex justify-end" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-[#0D0D1A]/55 backdrop-blur-sm transition-opacity"
        aria-label="Zamknij panel AI Brief"
        onClick={onClose}
      />

      <aside
        id={panelId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${panelId}-title`}
        className="relative flex h-dvh w-full max-w-md flex-col border-l border-white/10 bg-gradient-to-b from-[#2D0A6B]/20 via-[#1a0538]/40 to-[#0D0D1A]/90 shadow-[-16px_0_48px_rgba(45,10,107,0.35)] backdrop-blur-md transition-transform duration-300 ease-out sm:max-w-lg"
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#00C9D4]/10 blur-3xl" />
          <div className="absolute -bottom-20 left-8 h-56 w-56 rounded-full bg-[#2D0A6B]/30 blur-3xl" />
        </div>

        <header className="relative shrink-0 border-b border-white/10 px-5 pb-4 pt-5 sm:px-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#2D0A6B]/10 p-2 backdrop-blur-md">
                <img src={sectorIconSrc} alt="" className="h-full w-full object-contain" aria-hidden />
              </div>
              <div className="min-w-0">
                <p id={`${panelId}-title`} className="truncate text-lg font-bold text-white">
                  {company.name}
                </p>
                <p className="font-mono text-sm font-semibold text-[#00C9D4]">{company.symbol}</p>
                <p className="mt-0.5 truncate text-xs text-white/55">{company.sector}</p>
              </div>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#2D0A6B]/10 text-white/80 backdrop-blur-md transition hover:border-[#00C9D4]/40 hover:text-white"
              aria-label="Zamknij AI Brief"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#00C9D4]/25 bg-[#00C9D4]/10 px-3 py-1 text-[11px] font-medium text-[#00C9D4] backdrop-blur-md">
            <SparklesIcon className="h-3.5 w-3.5" aria-hidden />
            Analysis powered by Claude 3.5 Sonnet
          </span>
        </header>

        <div className="relative flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          <section className="rounded-2xl border border-white/10 bg-[#2D0A6B]/10 p-4 backdrop-blur-md">
            <h2 className="text-sm font-bold uppercase tracking-wide text-white/90">Szybki Przegląd Poranny</h2>
            <ul className="mt-3 space-y-3 text-sm leading-relaxed text-white/80">
              {insight.morningBullets.map((bullet) => (
                <li key={bullet.slice(0, 48)} className="flex gap-2.5">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#00C9D4]" aria-hidden />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#2D0A6B]/10 p-4 backdrop-blur-md">
            <h2 className="text-sm font-bold uppercase tracking-wide text-white/90">Sentyment Sektorowy</h2>
            <p className="mt-1 text-xs text-white/50">Na podstawie agregacji newsów i sygnałów makro w sektorze {company.sector}.</p>
            <div className="mt-4">
              <SentimentGauge score={insight.sentiment.score} label={insight.sentiment.label} />
            </div>
          </section>

          <section className="rounded-2xl border border-amber-400/25 bg-gradient-to-br from-amber-500/10 to-[#2D0A6B]/10 p-4 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <ExclamationTriangleIcon className="h-5 w-5 text-amber-300" aria-hidden />
              <h2 className="text-sm font-bold uppercase tracking-wide text-amber-100">Behavioral Warning</h2>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-amber-50/90">
              <span className="font-semibold text-amber-200">AI Coach: </span>
              {insight.behavioralWarning}
            </p>
          </section>
        </div>

        <footer className="relative shrink-0 space-y-4 border-t border-white/10 p-5 sm:px-6">
          <InvestmentDisclaimer variant="drawer" />
          <Link
            to={premiumHref}
            onClick={onClose}
            className="block rounded-2xl border border-[#00C9D4]/20 bg-gradient-to-r from-[#2D0A6B]/20 to-[#00C9D4]/10 px-4 py-3.5 text-center text-sm leading-snug text-white/85 backdrop-blur-md transition hover:border-[#00C9D4]/40 hover:from-[#2D0A6B]/30"
          >
            <span className="text-white/70">Chcesz codziennych powiadomień SMS/Push dla tej spółki?</span>{" "}
            <span className="font-semibold text-[#00C9D4]">Odblokuj alerty StockAI Pro</span>
          </Link>
        </footer>
      </aside>
    </div>
  );
}
