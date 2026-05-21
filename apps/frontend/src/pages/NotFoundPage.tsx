import { Link } from "react-router-dom";
import { colors } from "../styles/designSystem";

export function NotFoundPage() {
  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bgPrimary px-4 py-16"
      style={{
        backgroundImage: `linear-gradient(145deg, ${colors.brandDark}0d 0%, ${colors.bgPrimary} 55%)`,
      }}
    >
      <div className="relative z-10 w-full max-w-xl rounded-3xl border border-border bg-bgPrimary p-8 text-center shadow-[0_24px_72px_rgba(168,85,247,0.12)]">
        <p className="text-9xl font-extrabold leading-none text-brandDark">404</p>
        <h1 className="mt-6 text-3xl font-bold text-textPrimary">Nie znaleziono strony</h1>
        <p className="mt-3 text-sm text-textSecondary">
          Strona, której szukasz, nie istnieje lub została przeniesiona.
        </p>
        <Link
          to="/"
          className="mt-8 inline-flex items-center justify-center rounded-xl bg-brandDark px-6 py-3 text-sm font-semibold text-white transition hover:brightness-110"
        >
          Wróć do strony głównej
        </Link>
      </div>
    </div>
  );
}
