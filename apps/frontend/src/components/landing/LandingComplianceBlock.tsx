import { useTranslation } from "react-i18next";

type Props = {
  className?: string;
};

export function LandingComplianceBlock({ className = "" }: Props) {
  const { t } = useTranslation("common");

  const bullets = [
    t("landing.compliance.educational"),
    t("landing.compliance.notAdvice"),
    t("landing.compliance.decisionSupport"),
    t("landing.compliance.marketData"),
  ];

  return (
    <aside
      className={`rounded-2xl border border-amber-400/25 bg-amber-500/10 px-5 py-5 text-left sm:px-6 sm:py-6 ${className}`}
      role="note"
      aria-label={t("landing.compliance.ariaLabel")}
    >
      <h3 className="text-sm font-bold uppercase tracking-wide text-amber-200">
        {t("landing.compliance.title")}
      </h3>
      <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-white/85">
        {bullets.map((line) => (
          <li key={line} className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" aria-hidden />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
