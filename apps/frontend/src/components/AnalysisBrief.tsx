import { SparklesIcon } from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";
import type { AnalysisResponse, BriefSection } from "../services/api";

type Props = {
  analysis: AnalysisResponse | null;
  loading?: boolean;
  error?: string | null;
};

function primaryLanguageBase(lang: string): string {
  const trimmed = lang.trim();
  if (!trimmed) return "en";
  return trimmed.split(/[-_]/)[0]!.toLowerCase();
}

function isEnglishSection(section: BriefSection): boolean {
  return section.lang === "en" || primaryLanguageBase(section.lang) === "en";
}

function localSectionHeading(section: BriefSection, uiLocale: string): string {
  if (isEnglishSection(section)) return "";
  try {
    const code = primaryLanguageBase(section.lang);
    return new Intl.DisplayNames([uiLocale], { type: "language" }).of(code) ?? section.lang;
  } catch {
    return section.lang;
  }
}

export function AnalysisBrief({ analysis, loading, error }: Props) {
  const { t, i18n } = useTranslation();

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

  const sections: BriefSection[] =
    analysis.sections && analysis.sections.length > 0
      ? analysis.sections
      : [{ lang: analysis.requestedLang ?? "en", body: analysis.brief }];

  const multiSection = sections.length > 1;

  return (
    <div className="rounded-2xl border border-surface-border bg-surface-elevated p-6">
      <div className="mb-3 flex items-center gap-2 text-accent-muted">
        <SparklesIcon className="h-5 w-5" />
        <h3 className="text-sm font-semibold uppercase tracking-wide">
          {t("analysisBrief.title", { defaultValue: "AI brief" })}
        </h3>
      </div>
      <p className="mb-4 text-xs text-slate-500">
        {t("analysisBrief.updated", { defaultValue: "Updated" })} {new Date(analysis.updatedAt).toLocaleString()}
      </p>
      <div className="max-h-[480px] overflow-y-auto text-sm leading-relaxed text-slate-200">
        {sections.map((sec, index) => {
          const heading = isEnglishSection(sec)
            ? t("analysisBrief.englishSection", { defaultValue: "English" })
            : localSectionHeading(sec, i18n.language);
          return (
            <div key={`${sec.lang}-${index}`}>
              {index > 0 ? <hr className="my-5 border-surface-border" /> : null}
              {multiSection ? (
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{heading}</h4>
              ) : null}
              <div className="whitespace-pre-wrap">{sec.body}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
