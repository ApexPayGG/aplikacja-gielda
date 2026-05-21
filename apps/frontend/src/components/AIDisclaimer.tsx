import { Link } from "react-router-dom";

type Variant = "default" | "compact" | "dark";

type Props = {
  variant?: Variant;
  className?: string;
};

const DISCLAIMER_TEXT =
  "Treści generowane przez sztuczną inteligencję (analizy, sygnały, coaching behawioralny) mają wyłącznie charakter informacyjny i edukacyjny. Nie stanowią rekomendacji inwestycyjnej ani porady finansowej. Systemy AI mogą zawierać błędy — każda decyzja inwestycyjna należy wyłącznie do Ciebie.";

export function AIDisclaimer({ variant = "default", className = "" }: Props) {
  if (variant === "compact") {
    return (
      <p className={`text-[11px] leading-snug text-textSecondary ${className}`}>
        {DISCLAIMER_TEXT}{" "}
        <Link to="/terms" className="font-medium text-brandCyan underline-offset-2 hover:underline">
          Regulamin
        </Link>
      </p>
    );
  }

  if (variant === "dark") {
    return (
      <div
        className={`rounded-xl border border-white/10 bg-[#1e1b4b]/20 px-3 py-2.5 text-[11px] leading-relaxed text-white/60 ${className}`}
        role="note"
        aria-label="Zastrzeżenie dotyczące treści AI"
      >
        <p>{DISCLAIMER_TEXT}</p>
        <p className="mt-1.5">
          <Link to="/terms" className="font-medium text-[#22d3ee]/90 underline-offset-2 hover:underline">
            Pełny regulamin i disclaimer inwestycyjny
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-amber-400/25 bg-amber-500/5 px-4 py-3 text-xs leading-relaxed text-textSecondary ${className}`}
      role="note"
      aria-label="Zastrzeżenie dotyczące treści AI"
    >
      <p className="font-medium text-textPrimary">Zastrzeżenie AI</p>
      <p className="mt-1">{DISCLAIMER_TEXT}</p>
      <p className="mt-2">
        <Link to="/terms" className="font-medium text-brandCyan underline-offset-2 hover:underline">
          Regulamin i disclaimer inwestycyjny
        </Link>
      </p>
    </div>
  );
}
