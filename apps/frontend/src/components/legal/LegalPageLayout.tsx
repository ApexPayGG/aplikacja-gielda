import { type ReactNode, useEffect } from "react";
import { Link } from "react-router-dom";
import { colors } from "../../styles/designSystem";

type Props = {
  title: string;
  documentLabel: string;
  effectiveDate?: string;
  intro: ReactNode;
  children: ReactNode;
};

export function LegalPageLayout({ title, documentLabel, effectiveDate, intro, children }: Props) {
  useEffect(() => {
    document.title = `${title} | StockAI Pro`;
  }, [title]);

  return (
    <div
      className="min-h-screen bg-bgSecondary px-4 py-12 md:py-16"
      style={{ backgroundImage: `linear-gradient(180deg, ${colors.brandDark}08 0%, ${colors.bgSecondary} 35%)` }}
    >
      <div className="mx-auto max-w-4xl rounded-3xl border border-border bg-bgPrimary p-6 shadow-sm md:p-10">
        <header className="mb-8 border-b border-border pb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-brandCyan">{documentLabel}</p>
          <h1 className="mt-2 text-3xl font-bold text-textPrimary">{title}</h1>
          {effectiveDate ? (
            <p className="mt-2 text-sm text-textSecondary">Data wejścia w życie: {effectiveDate}</p>
          ) : null}
          <div className="mt-3 text-sm leading-6 text-textSecondary">{intro}</div>
        </header>

        {children}

        <footer className="mt-10 flex flex-wrap items-center gap-4 border-t border-border pt-6">
          <Link
            to="/"
            className="inline-flex items-center rounded-lg bg-brandDark px-4 py-2 text-sm font-semibold text-white transition hover:bg-brandMedium"
          >
            Powrót na stronę główną
          </Link>
          <Link to="/privacy" className="text-sm font-medium text-brandCyan hover:underline">
            Polityka prywatności
          </Link>
          <Link to="/terms" className="text-sm font-medium text-brandCyan hover:underline">
            Regulamin
          </Link>
        </footer>
      </div>
    </div>
  );
}
