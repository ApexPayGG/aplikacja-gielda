import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { fetchUserAccess, type UserAccessSnapshot } from "../services/access";
import { trackEvent } from "../utils/analytics";
import { normalizeUserPlan } from "../utils/subscriptionTier";

type LoadStatus = "loading" | "ready" | "error";

function formatPlanLabel(tier: string | null | undefined): string {
  const plan = normalizeUserPlan(tier);
  if (plan === "PRO+") return "Pro+";
  if (plan === "PRO") return "Pro";
  return "Free";
}

function formatTrialEndDate(iso: string | null | undefined, locale: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
}

function isCanceledSubscription(status: string | null | undefined): boolean {
  const normalized = String(status ?? "")
    .trim()
    .toLowerCase();
  return normalized === "canceled" || normalized === "cancelled";
}

function resolveAccessMessage(
  access: UserAccessSnapshot,
  t: (key: string, options?: Record<string, unknown>) => string,
  locale: string,
): { subtitle: string; trialEndLine: string | null } {
  const plan = formatPlanLabel(access.tier);

  if (access.accessState === "SUBSCRIPTION_TRIALING") {
    const subtitle = t("errorPages.paymentSuccessProTrialActive", {
      plan,
      defaultValue: `Your ${plan} trial is active.`,
    });
    const trialEnd = formatTrialEndDate(access.trialEndsAt, locale);
    const trialEndLine = trialEnd
      ? t("errorPages.paymentSuccessTrialEnds", {
          date: trialEnd,
          defaultValue: "Trial ends on {{date}}.",
        })
      : null;
    return { subtitle, trialEndLine };
  }

  if (access.accessState === "SUBSCRIPTION_ACTIVE") {
    return {
      subtitle: t("errorPages.paymentSuccessPlanActive", {
        plan,
        defaultValue: `Your ${plan} plan is active.`,
      }),
      trialEndLine: null,
    };
  }

  if (access.accessState === "TRIAL_ACTIVE" && isCanceledSubscription(access.subscriptionStatus)) {
    return {
      subtitle: t("errorPages.paymentSuccessTrialRemains", {
        defaultValue: "Your trial remains active.",
      }),
      trialEndLine: null,
    };
  }

  if (access.accessState === "TRIAL_ACTIVE") {
    const trialEnd = formatTrialEndDate(access.trialEndsAt, locale);
    return {
      subtitle: t("errorPages.paymentSuccessTrialRemains", {
        defaultValue: "Your trial remains active.",
      }),
      trialEndLine: trialEnd
        ? t("errorPages.paymentSuccessTrialEnds", {
            date: trialEnd,
            defaultValue: "Trial ends on {{date}}.",
          })
        : null,
    };
  }

  if (access.canUseProduct && plan !== "Free") {
    return {
      subtitle: t("errorPages.paymentSuccessPlanActive", {
        plan,
        defaultValue: `Your ${plan} plan is active.`,
      }),
      trialEndLine: null,
    };
  }

  return {
    subtitle: t("errorPages.paymentSuccessAccessPending", {
      defaultValue: "Payment received. We're refreshing your access status.",
    }),
    trialEndLine: null,
  };
}

const confettiOffsets = [4, 10, 16, 22, 28, 34, 40, 46, 52, 58, 64, 70, 76, 82, 88, 94];

export function PaymentSuccessPage() {
  const { t, i18n } = useTranslation();
  const { refreshUser } = useAuth();
  const [access, setAccess] = useState<UserAccessSnapshot | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const paymentEventSent = useRef(false);

  useEffect(() => {
    document.title = t("errorPages.seoPaymentSuccessTitle", {
      defaultValue: "Payment completed | StockAI Pro",
    });
  }, [t]);

  useEffect(() => {
    let active = true;

    const loadAccess = async () => {
      setStatus("loading");
      try {
        const [snapshot] = await Promise.all([fetchUserAccess(), refreshUser()]);
        if (!active) return;
        setAccess(snapshot);
        setStatus("ready");
      } catch {
        if (!active) return;
        setAccess(null);
        setStatus("error");
        try {
          await refreshUser();
        } catch {
          // ignore secondary refresh failure
        }
      }
    };

    void loadAccess();
    return () => {
      active = false;
    };
  }, [refreshUser]);

  const message = useMemo(() => {
    if (status === "loading") {
      return {
        subtitle: t("errorPages.paymentSuccessRefreshing", {
          defaultValue: "Updating your subscription...",
        }),
        trialEndLine: null,
      };
    }
    if (status === "error" || !access) {
      return {
        subtitle: t("errorPages.paymentSuccessAccessPending", {
          defaultValue: "Payment received. We're refreshing your access status.",
        }),
        trialEndLine: null,
      };
    }
    return resolveAccessMessage(access, t, i18n.language);
  }, [access, i18n.language, status, t]);

  useEffect(() => {
    if (status !== "ready" || !access || paymentEventSent.current) return;
    paymentEventSent.current = true;
    const normalizedPlan = normalizeUserPlan(access.tier);
    trackEvent("payment_success", {
      plan: normalizedPlan === "PRO+" ? "pro_plus" : normalizedPlan.toLowerCase(),
      accessState: access.accessState,
    });
  }, [access, status]);

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
          OK
        </div>
        <h1 className="mt-6 text-3xl font-bold text-textPrimary">
          {t("errorPages.paymentSuccessTitle", { defaultValue: "Payment successful!" })}
        </h1>
        <p className="mt-3 text-base text-textSecondary">{message.subtitle}</p>
        {message.trialEndLine ? (
          <p className="mt-2 text-sm text-textSecondary">{message.trialEndLine}</p>
        ) : null}

        <div className="mt-8 flex flex-col gap-3">
          <Link
            to="/dashboard"
            className="inline-flex w-full justify-center rounded-xl bg-brandDark px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110"
          >
            {t("errorPages.goToApp", { defaultValue: "Go to app" })}
          </Link>
          {status === "error" ? (
            <Link
              to="/pricing"
              className="inline-flex w-full justify-center rounded-xl border border-borderStrong bg-bgPrimary px-5 py-3 text-sm font-semibold text-textPrimary transition hover:bg-bgSecondary"
            >
              {t("errorPages.backToPricing", { defaultValue: "Back to pricing" })}
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  );
}
