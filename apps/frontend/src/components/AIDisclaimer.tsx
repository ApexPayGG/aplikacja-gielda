import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

type Variant = "default" | "compact" | "dark";

type Props = {
  variant?: Variant;
  className?: string;
};

export function AIDisclaimer({ variant = "default", className = "" }: Props) {
  const { t } = useTranslation();
  const disclaimerText = t("aiDisclaimer.text", {
    defaultValue:
      "AI-generated content (analyses, signals, behavioral coaching) is for informational and educational purposes only. It is not investment advice or financial guidance. AI systems may contain errors — every investment decision is yours alone.",
  });
  const termsLabel = t("aiDisclaimer.termsLink", { defaultValue: "Terms" });
  const fullTermsLabel = t("aiDisclaimer.fullTermsLink", {
    defaultValue: "Full terms and investment disclaimer",
  });
  const ariaLabel = t("aiDisclaimer.aria", { defaultValue: "AI content disclaimer" });
  const title = t("aiDisclaimer.title", { defaultValue: "AI disclaimer" });

  if (variant === "compact") {
    return (
      <p className={`text-[11px] leading-snug text-textSecondary ${className}`}>
        {disclaimerText}{" "}
        <Link to="/terms" className="font-medium text-brandCyan underline-offset-2 hover:underline">
          {termsLabel}
        </Link>
      </p>
    );
  }

  if (variant === "dark") {
    return (
      <div
        className={`rounded-xl border border-white/10 bg-[#1e1b4b]/20 px-3 py-2.5 text-[11px] leading-relaxed text-white/60 ${className}`}
        role="note"
        aria-label={ariaLabel}
      >
        <p>{disclaimerText}</p>
        <p className="mt-1.5">
          <Link to="/terms" className="font-medium text-[#22d3ee]/90 underline-offset-2 hover:underline">
            {fullTermsLabel}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-amber-400/25 bg-amber-500/5 px-4 py-3 text-xs leading-relaxed text-textSecondary ${className}`}
      role="note"
      aria-label={ariaLabel}
    >
      <p className="font-medium text-textPrimary">{title}</p>
      <p className="mt-1">{disclaimerText}</p>
      <p className="mt-2">
        <Link to="/terms" className="font-medium text-brandCyan underline-offset-2 hover:underline">
          {fullTermsLabel}
        </Link>
      </p>
    </div>
  );
}
