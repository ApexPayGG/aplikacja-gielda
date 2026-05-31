import { SparklesIcon } from "@heroicons/react/24/outline";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { AnalysisResponse } from "../services/api";
import { pickBriefSectionsForLocale } from "../utils/briefLocale";
import { GLASS_SECTION } from "./behavioral-coach/glassStyles";
import { sanitizeApiErrorMessage } from "../utils/sanitizeApiErrorMessage";
import { formatLocaleDateTime } from "../utils/formatters";

export type BriefLimitReached = {
  limit: number;
};

type Props = {
  analysis: AnalysisResponse | null;
  loading?: boolean;
  error?: string | null;
  limitReached?: BriefLimitReached | null;
  /** Terminal cockpit readability - spacing and width only; no content changes. */
  variant?: "default" | "terminal";
};

const TERMINAL_BRIEF_SHELL = "rounded-lg border border-terminal-border bg-terminal-panel/80 p-3 sm:p-4";
const TERMINAL_BRIEF_BODY =
  "max-w-3xl text-sm leading-[1.65] tracking-normal text-terminal-textSecondary";

export function AnalysisBrief({ analysis, loading, error, limitReached, variant = "default" }: Props) {
  const isTerminal = variant === "terminal";
  const { t, i18n } = useTranslation();

  if (limitReached) {
    const limit = limitReached.limit;
    return (
      <div className="rounded-2xl border border-brandGold/40 bg-amber-50 p-6 text-sm text-textPrimary">
        <p>
          {t("analysisBrief.limitReached", {
            defaultValue:
              "You have used your daily limit ({{used}}/{{limit}}). Upgrade to Pro for unlimited access.",
            used: limit,
            limit,
          })}
        </p>
        <Link
          to="/pricing"
          className="mt-4 inline-flex rounded-lg bg-brandDark px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
        >
          {t("analysisBrief.upgradeCta", { defaultValue: "View Pro plans" })}
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className={
          isTerminal
            ? `${TERMINAL_BRIEF_SHELL} animate-pulse`
            : `animate-pulse ${GLASS_SECTION}`
        }
      >
        <div className={isTerminal ? "h-3 w-1/3 rounded bg-terminal-panelSecondary" : "h-4 w-1/3 rounded bg-slate-700"} />
        <div className="mt-4 space-y-2">
          <div className={isTerminal ? "h-3 rounded bg-terminal-panelSecondary" : "h-3 rounded bg-slate-700"} />
          <div className={isTerminal ? "h-3 rounded bg-terminal-panelSecondary" : "h-3 rounded bg-slate-700"} />
          <div
            className={
              isTerminal ? "h-3 w-5/6 rounded bg-terminal-panelSecondary" : "h-3 w-5/6 rounded bg-slate-700"
            }
          />
        </div>
      </div>
    );
  }

  if (error) {
    const safe = sanitizeApiErrorMessage(error);
    return (
      <div className="rounded-2xl border border-amber-900/40 bg-amber-950/20 p-4 text-sm text-amber-100">
        <p>
          {safe ||
            t("analysisBrief.unavailable", {
              defaultValue:
                "AI brief is temporarily unavailable. Showing sector-based context when possible - try again in a moment.",
            })}
        </p>
      </div>
    );
  }

  if (!analysis) {
    return null;
  }

  const rawSections =
    analysis.sections && analysis.sections.length > 0
      ? analysis.sections
      : [{ lang: analysis.requestedLang ?? i18n.language, body: analysis.brief }];

  const sections = pickBriefSectionsForLocale(rawSections, i18n.language);

  if (isTerminal) {
    return (
      <div className={TERMINAL_BRIEF_SHELL}>
        <div className="mb-2 flex items-center gap-2 border-b border-terminal-borderMuted/80 pb-2">
          <SparklesIcon className="h-4 w-4 text-terminal-cyan" />
          <h3 className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-terminal-cyan">
            {t("analysisBrief.title", { defaultValue: "AI brief" })}
          </h3>
        </div>
        <p className="mb-3 font-mono text-[10px] text-terminal-textMuted">
          {t("analysisBrief.updated", { defaultValue: "Updated" })}{" "}
          {formatLocaleDateTime(analysis.updatedAt, i18n.language)}
        </p>
        <div className={`max-h-[min(520px,60vh)] overflow-y-auto pr-1 ${TERMINAL_BRIEF_BODY}`}>
          {sections.map((sec, index) => (
            <div
              key={`${sec.lang}-${index}`}
              className={index > 0 ? "mt-5 whitespace-pre-wrap" : "whitespace-pre-wrap"}
            >
              {sec.body}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={GLASS_SECTION}>
      <div className="mb-3 flex items-center gap-2 text-textPrimary">
        <SparklesIcon className="h-5 w-5 text-brandDark" />
        <h3 className="text-sm font-semibold uppercase tracking-wide">
          {t("analysisBrief.title", { defaultValue: "AI brief" })}
        </h3>
      </div>
      <p className="mb-4 text-xs text-textSecondary">
        {t("analysisBrief.updated", { defaultValue: "Updated" })}{" "}
        {formatLocaleDateTime(analysis.updatedAt, i18n.language)}
      </p>
      <div className="max-h-[480px] overflow-y-auto text-sm leading-relaxed text-textPrimary">
        {sections.map((sec, index) => (
          <div key={`${sec.lang}-${index}`} className="whitespace-pre-wrap">
            {sec.body}
          </div>
        ))}
      </div>
    </div>
  );
}
