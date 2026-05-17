import { Link } from "react-router-dom";

export function PaymentCancelPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bgSecondary px-4 py-10">
      <section className="w-full max-w-xl rounded-3xl border border-border bg-bgPrimary p-8 text-center shadow-[0_24px_72px_rgba(45,10,107,0.14)] sm:p-10">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-negative/15 text-5xl font-bold text-negative">
          ✕
        </div>
        <h1 className="mt-6 text-3xl font-bold text-textPrimary">Płatność anulowana</h1>
        <p className="mt-3 text-base text-textSecondary">Możesz wrócić do cennika i dokończyć zakup w dowolnym momencie.</p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/pricing"
            className="inline-flex w-full justify-center rounded-xl border border-borderStrong bg-bgPrimary px-5 py-3 text-sm font-semibold text-textPrimary transition hover:bg-bgSecondary sm:w-auto"
          >
            Wróć do cennika
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex w-full justify-center rounded-xl bg-brandDark px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 sm:w-auto"
          >
            Przejdź do aplikacji
          </Link>
        </div>
      </section>
    </div>
  );
}
