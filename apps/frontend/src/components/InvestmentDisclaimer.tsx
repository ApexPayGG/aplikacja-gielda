import { Link } from "react-router-dom";

export const INVESTMENT_DISCLAIMER_TEXT =
  "Zastrzeżenie prawne: Wszelkie analizy, sygnały rynkowe oraz materiały generowane przez sztuczną inteligencję (w tym Claude AI) na platformie StockAI Pro mają charakter wyłącznie edukacyjny i informacyjny. Nie stanowią one rekomendacji inwestycyjnych ani porad finansowych w rozumieniu przepisów prawa. Inwestowanie na rynkach finansowych wiąże się z wysokim ryzykiem utraty kapitału. AMC Energy Sp. z o.o. nie ponosi odpowiedzialności za decyzje finansowe podjęte na podstawie danych w aplikacji.";

type Variant = "default" | "landing" | "drawer";

type Props = {
  variant?: Variant;
  className?: string;
  showTermsLink?: boolean;
};

export function InvestmentDisclaimer({ variant = "default", className = "", showTermsLink = true }: Props) {
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
      aria-label="Zastrzeżenie prawne inwestycyjne"
    >
      <p>{INVESTMENT_DISCLAIMER_TEXT}</p>
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
            Pełny regulamin
          </Link>
        </p>
      ) : null}
    </aside>
  );
}
