import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";

function normalizePlanLabel(plan: string | null): string {
  const value = String(plan ?? "").trim().toLowerCase();
  if (value === "pro_plus" || value === "pro-plus" || value === "pro plus") return "Pro+";
  if (value === "pro") return "Pro";
  return "Pro";
}

function resolvePlanLabel(params: URLSearchParams): string {
  const fromQuery = params.get("plan");
  if (fromQuery) return normalizePlanLabel(fromQuery);
  if (typeof window !== "undefined") {
    const fromStorage = window.localStorage.getItem("checkout_plan");
    if (fromStorage) return normalizePlanLabel(fromStorage);
  }
  return "Pro";
}

const confettiOffsets = [4, 10, 16, 22, 28, 34, 40, 46, 52, 58, 64, 70, 76, 82, 88, 94];

export function PaymentSuccessPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const plan = useMemo(() => resolvePlanLabel(params), [params]);

  useEffect(() => {
    document.title = t("errorPages.seoPaymentSuccessTitle", {
      defaultValue: "Payment completed | StockAI Pro",
    });
  }, [t]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bgSecondary px-4 py-10">
      <div className="payment-confetti" aria-hidden="true">
        {confettiOffsets.map((leftOffset, index) => (
          <span
            key={`${leftOffset}-${index}`}
            className="payment-confetti-piece"
            style={{
              left: `${leftOffset}%`,
              animationDelay: `${(index % 8) * 0.18}s`,
              animationDuration: `${3.2 + (index % 4) * 0.35}s`,
            }}
          />
        ))}
      </div>

      <section className="relative z-10 w-full max-w-xl rounded-3xl border border-border bg-bgPrimary p-8 text-center shadow-[0_24px_72px_rgba(168,85,247,0.18)] sm:p-10">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-positive/15 text-6xl font-bold text-positive">
          ✓
        </div>
        <h1 className="mt-6 text-3xl font-bold text-textPrimary">
          {t("errorPages.paymentSuccessTitle", { defaultValue: "Payment successful!" })}
        </h1>
        <p className="mt-3 text-base text-textSecondary">
          {t("errorPages.paymentSuccessSubtitle", { plan, defaultValue: "Your {{plan}} plan is active." })}
        </p>

        <Link
          to="/dashboard"
          className="mt-8 inline-flex w-full justify-center rounded-xl bg-brandDark px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110"
        >
          {t("errorPages.goToApp", { defaultValue: "Go to app" })}
        </Link>
      </section>
    </div>
  );
}
