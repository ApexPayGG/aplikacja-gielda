import { SparklesIcon } from "@heroicons/react/24/outline";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { AnalysisResponse } from "../services/api";
import { pickBriefSectionsForLocale } from "../utils/briefLocale";
import { sanitizeApiErrorMessage } from "../utils/sanitizeApiErrorMessage";

export type BriefLimitReached = {
  limit: number;
};

type Props = {
  analysis: AnalysisResponse | null;
  loading?: boolean;
  error?: string | null;
  limitReached?: BriefLimitReached | null;
};

export function AnalysisBrief({ analysis, loading, error, limitReached }: Props) {
  const { t, i18n } = useTranslation();

  if (limitReached) {
    const limit = limitReached.limit;
    return (
      <div className="rounded-2xl border border-brandGold/40 bg-amber-50 p-6 text-sm text-textPrimary">
        <p>
          {t("analysisBrief.limitReached", {
            defaultValue:
              "Wykorzystałeś dzienny limit ({{used}}/{{limit}}). Przejdź na Pro aby uzyskać nieograniczony dostęp.",
            used: limit,
            limit,
          })}
        </p>
        <Link
          to="/pricing"
          className="mt-4 inline-flex rounded-lg bg-brandDark px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
        >
          {t("analysisBrief.upgradeCta", { defaultValue: "Zobacz plany Pro" })}
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="animate-pulse rounded-2xl border border-surface-border bg-surface-elevated p-6">
        <div className="h-4 w-1/3 rounded bg-slate-700" />
        <div className="mt-4 space-y-2">
          <div className="h-3 rounded bg-slate-700" />
          <div className="h-3 rounded bg-slate-700" />
          <div className="h-3 w-5/6 rounded bg-slate-700" />
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
                "AI brief is temporarily unavailable. Showing sector-based context when possible — try again in a moment.",
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

  return (
    <div className="rounded-2xl border border-surface-border bg-surface-elevated p-6">
      <div className="mb-3 flex items-center gap-2 text-textPrimary">
        <SparklesIcon className="h-5 w-5 text-brandDark" />
        <h3 className="text-sm font-semibold uppercase tracking-wide">
          {t("analysisBrief.title", { defaultValue: "AI brief" })}
        </h3>
      </div>
      <p className="mb-4 text-xs text-textSecondary">
        {t("analysisBrief.updated", { defaultValue: "Updated" })} {new Date(analysis.updatedAt).toLocaleString()}
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
