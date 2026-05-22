import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { SEOHead } from "../components/SEOHead";
import { getWaitlistCount, joinWaitlist, type WaitlistSource } from "../services/api";
import { colors } from "../styles/designSystem";
import { apiErrorMessage } from "../utils/apiErrorMessage";

const ALLOWED_SOURCES: WaitlistSource[] = ["landing", "pricing", "signal"];

function parseSource(value: string | null): WaitlistSource | undefined {
  if (!value) return undefined;
  return ALLOWED_SOURCES.includes(value as WaitlistSource) ? (value as WaitlistSource) : undefined;
}

export function WaitlistPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const benefits = useMemo(
    () => [
      t("waitlistPage.benefit1", {
        defaultValue: "Permanent Early Adopter price: Pro $9/mo — forever.",
      }),
      t("waitlistPage.benefit2", {
        defaultValue: "Priority access to new AI modules.",
      }),
      t("waitlistPage.benefit3", {
        defaultValue: "Influence the product roadmap and premium features.",
      }),
      t("waitlistPage.benefit4", {
        defaultValue: "Dedicated onboarding materials for founding users.",
      }),
    ],
    [t],
  );

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const source = useMemo(() => parseSource(searchParams.get("source")), [searchParams]);

  useEffect(() => {
    let active = true;
    void getWaitlistCount()
      .then((response) => {
        if (active) setCount(response.count);
      })
      .catch(() => {
        if (active) setCount(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await joinWaitlist({
        email: email.trim(),
        name: name.trim() || undefined,
        source,
      });
      setSubmitted(true);
      setCount(response.count);
    } catch (submissionError) {
      setError(apiErrorMessage(submissionError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bgSecondary text-textSecondary">
      <SEOHead
        title="Waitlist — StockAI Pro Early Access"
        description={t("waitlistPage.seoDescription", {
          defaultValue: "Join the Early Access list and lock in the Early Adopter price for StockAI Pro.",
        })}
      />

      <section
        className="px-6 py-16 md:py-20"
        style={{ backgroundImage: `linear-gradient(135deg, ${colors.brandDark} 0%, ${colors.brandMedium} 100%)` }}
      >
        <div className="mx-auto max-w-4xl">
          <h1 className="text-4xl font-bold text-white md:text-5xl">
            {t("waitlistPage.title", { defaultValue: "Join Early Access" })}
          </h1>
          <p className="mt-4 max-w-2xl text-base text-white/90 md:text-lg">
            {t("waitlistPage.subhead", {
              defaultValue: "The first 500 accounts get the Early Adopter price forever: Pro $9/mo",
            })}
          </p>

          <div className="mt-8 glass-section p-6 shadow-lg md:p-8">
            {submitted ? (
              <p className="text-base font-semibold text-brandDark">
                {t("waitlistPage.successOnList", {
                  defaultValue: "You are on the list! Check your inbox.",
                })}
              </p>
            ) : (
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="waitlist-name" className="mb-1 block text-sm font-medium text-textPrimary">
                    {t("waitlistPage.nameLabel", { defaultValue: "Name (optional)" })}
                  </label>
                  <input
                    id="waitlist-name"
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={t("waitlistPage.namePlaceholder", { defaultValue: "Your first name" })}
                    className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-textPrimary outline-none transition focus:border-brandDark focus:ring-2 focus:ring-brandDark/20"
                  />
                </div>

                <div>
                  <label htmlFor="waitlist-email" className="mb-1 block text-sm font-medium text-textPrimary">
                    {t("waitlistPage.emailLabel", { defaultValue: "Email" })}
                  </label>
                  <input
                    id="waitlist-email"
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@email.com"
                    className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-textPrimary outline-none transition focus:border-brandDark focus:ring-2 focus:ring-brandDark/20"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
                  style={{ backgroundColor: colors.brandDark }}
                >
                  {submitting ? t("waitlistPage.ctaSubmitting", { defaultValue: "Submitting…" }) : t("waitlistPage.ctaJoin", { defaultValue: "Join the waitlist" })}
                </button>

                {error ? <p className="text-sm text-negative">{error}</p> : null}
              </form>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-12 md:py-16">
        <p className="text-lg font-semibold text-textPrimary">
          {count !== null
            ? t("waitlistPage.countWaiting", { count, defaultValue: "{{count}} people already waiting" })
            : `… ${t("waitlistPage.countWaitingUnknown", { defaultValue: "people already waiting" })}`}
        </p>

        <div className="mt-6 glass-section p-6 shadow-sm">
          <h2 className="text-xl font-bold text-textPrimary">
            {t("waitlistPage.benefitsHeading", { defaultValue: "Early Access benefits" })}
          </h2>
          <ul className="mt-4 space-y-3">
            {benefits.filter(Boolean).map((benefit) => (
              <li key={benefit} className="flex items-start gap-3 text-sm text-textSecondary">
                <span className="mt-0.5 font-semibold text-brandCyan">✓</span>
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
