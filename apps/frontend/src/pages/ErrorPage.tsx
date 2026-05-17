import { ExclamationTriangleIcon } from "@heroicons/react/24/solid";
import { useNavigate } from "react-router-dom";
import { colors } from "../styles/designSystem";

export function ErrorPage() {
  const navigate = useNavigate();

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-bgSecondary px-4 py-16"
      style={{
        backgroundImage: `radial-gradient(circle at top, ${colors.brandDark}14 0%, ${colors.bgSecondary} 60%)`,
      }}
    >
      <div className="w-full max-w-xl rounded-3xl border border-border bg-bgPrimary p-8 shadow-[0_20px_60px_rgba(13,13,26,0.12)]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brandGold/15">
          <ExclamationTriangleIcon className="h-8 w-8 text-brandGold" />
        </div>

        <h1 className="mt-6 text-center text-3xl font-bold text-textPrimary">Wystąpił błąd</h1>
        <p className="mt-3 text-center text-sm leading-6 text-textSecondary">
          Coś poszło nie tak podczas ładowania tej sekcji. Odśwież stronę lub wróć do poprzedniego widoku.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-xl bg-brandDark px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
          >
            Odśwież
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-xl border border-borderStrong bg-bgPrimary px-5 py-2.5 text-sm font-semibold text-textPrimary transition hover:border-brandDark hover:text-brandDark"
          >
            Wróć
          </button>
        </div>
      </div>
    </div>
  );
}
