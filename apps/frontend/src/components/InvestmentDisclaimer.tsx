import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

type Variant = "default" | "landing" | "drawer";

type Props = {
  variant?: Variant;
  className?: string;
  showTermsLink?: boolean;
};

export function InvestmentDisclaimer({ variant = "default", className = "", showTermsLink = true }: Props) {
  const { t } = useTranslation("common");

  const baseGlass =
    "rounded-xl border text-center text-[11px] leading-relaxed backdrop-blur-md sm:text-xs sm:leading-relaxed";

  const variantClass =
    variant === "landing"
      ? "border-white/15 bg-white/5 px-4 py-3 text-white/70"
      : variant === "drawer"
        ? "border-white/10 bg-[#2D0A6B]/25 px-3 py-2.5 text-white/65"
        : "border-[#2D0A6B]/15 bg-[#2D0A6B]/5 px-4 py-3 text-textSecondary";

  return (
    <aside
      className={`${baseGlass} ${variantClass} ${className}`}
      role="note"
      aria-label={t("legal.ariaLabel")}
    >
      <p>{t("legal.investmentDisclaimer")}</p>
      {showTermsLink ? (
        <p className="mt-2">
          <Link
            to="/terms"
            className={
              variant === "landing" || variant === "drawer"
                ? "font-medium text-[#00C9D4] underline-offset-2 hover:underline"
                : "font-medium text-brandCyan underline-offset-2 hover:underline"
            }
          >
            {t("legal.termsLink")}
          </Link>
        </p>
      ) : null}
    </aside>
  );
}
