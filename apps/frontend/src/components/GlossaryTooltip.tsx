import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { explainGlossaryTerm, type GlossaryExplainResponse } from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";

type GlossaryTooltipProps = {
  term: string;
  children: ReactNode;
};

export function GlossaryTooltip({ term, children }: GlossaryTooltipProps) {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<GlossaryExplainResponse | null>(null);

  async function loadIfNeeded(): Promise<void> {
    if (loading || payload) return;
    setLoading(true);
    setError(null);
    try {
      const lang = (i18n.resolvedLanguage || i18n.language || "en").trim();
      const result = await explainGlossaryTerm(term, lang);
      setPayload(result);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  function handleOpen(): void {
    setOpen(true);
    void loadIfNeeded();
  }

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={handleOpen}
      onMouseLeave={() => setOpen(false)}
      onFocus={handleOpen}
      onBlur={() => setOpen(false)}
    >
      <span className="cursor-help rounded border-b border-dashed border-brand-green/70 text-brand-green">
        {children}
      </span>
      {open && (
        <span className="absolute left-1/2 top-full z-50 mt-2 w-72 -translate-x-1/2 rounded-lg border border-brand-green/50 bg-[#070d14] p-3 text-xs text-slate-100 shadow-xl">
          <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wide text-brand-green">
            {term}
          </span>
          {loading && (
            <span className="inline-flex items-center gap-2 text-slate-300">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-green/30 border-t-brand-green" />
              {t("glossary.loading")}
            </span>
          )}
          {!loading && error && <span className="block text-brand-red">{error}</span>}
          {!loading && !error && payload && (
            <>
              <span className="block leading-5">{payload.explanation}</span>
              <span className="mt-2 block text-slate-300">
                {t("glossary.exampleLabel")}: {payload.example}
              </span>
            </>
          )}
        </span>
      )}
    </span>
  );
}
