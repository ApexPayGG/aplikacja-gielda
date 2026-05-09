import { SparklesIcon } from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";
import type { AnalysisResponse } from "../services/api";

type Props = {
  analysis: AnalysisResponse | null;
  loading?: boolean;
  error?: string | null;
};

export function AnalysisBrief({ analysis, loading, error }: Props) {
  const { t } = useTranslation();

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
    return (
      <div className="rounded-2xl border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-200">
        {error}
      </div>
    );
  }

  if (!analysis) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-surface-border bg-surface-elevated p-6">
      <div className="mb-3 flex items-center gap-2 text-accent-muted">
        <SparklesIcon className="h-5 w-5" />
        <h3 className="text-sm font-semibold uppercase tracking-wide">
          {t("analysisBrief.title", { defaultValue: "AI brief (PL + EN)" })}
        </h3>
      </div>
      <p className="mb-4 text-xs text-slate-500">
        {t("analysisBrief.updated", { defaultValue: "Updated" })} {new Date(analysis.updatedAt).toLocaleString()}
      </p>
      <div className="max-h-[480px] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
        {analysis.brief}
      </div>
    </div>
  );
}
