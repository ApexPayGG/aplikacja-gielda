import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { sendContactMessage } from "../services/api";
import { colors } from "../styles/designSystem";

type ContactSubjectValue = "Billing" | "Bug" | "Suggestion" | "Other";

export function ContactPage() {
  const { t } = useTranslation();

  const subjectOptions = useMemo(
    (): Array<{ value: ContactSubjectValue; labelKey: string }> => [
      { value: "Billing", labelKey: "contactPage.subjectPayments" },
      { value: "Bug", labelKey: "contactPage.subjectBug" },
      { value: "Suggestion", labelKey: "contactPage.subjectSuggestion" },
      { value: "Other", labelKey: "contactPage.subjectOther" },
    ],
    [],
  );

  const subjectLabels = useMemo(
    () =>
      subjectOptions.map((option) => ({
        value: option.value,
        label: t(option.labelKey, {
          defaultValue: option.value,
        }),
      })),
    [subjectOptions, t],
  );

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState<ContactSubjectValue>("Billing");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    document.title = t("contactPage.docTitle", { defaultValue: "Contact | StockAI Pro" });
  }, [t]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      await sendContactMessage({
        name: name.trim(),
        email: email.trim(),
        subject,
        message: message.trim(),
      });
      setSuccessMessage(t("contactPage.success", { defaultValue: "Message sent! We'll reply within 24 hours." }));
      setName("");
      setEmail("");
      setSubject("Billing");
      setMessage("");
    } catch {
      setErrorMessage(t("contactPage.errorGeneric", { defaultValue: "Something went wrong. Please try again." }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-bgSecondary px-4 py-12 md:py-16"
      style={{ backgroundImage: `linear-gradient(180deg, ${colors.brandDark}10 0%, ${colors.bgSecondary} 35%)` }}
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white md:text-5xl">
            {t("contactPage.title", { defaultValue: "Contact" })}
          </h1>
          <p className="mt-3 max-w-2xl text-base glass-muted md:text-lg">
            {t("contactPage.intro", {
              defaultValue: "Questions about StockAI Pro? Reach out — we answer within 24 hours.",
            })}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="glass-section rounded-3xl p-6 shadow-sm md:p-8">
            <h2 className="text-xl font-semibold text-white">
              {t("contactPage.contactInfoHeading", { defaultValue: "Contact details" })}
            </h2>
            <div className="mt-6 space-y-5">
              <div>
                <p className="text-sm font-semibold text-white">
                  {t("privacyPageLayout.email", { defaultValue: "Email" })}
                </p>
                <a href="mailto:support@stock-ai.pro" className="mt-1 inline-block text-sm text-white hover:underline">
                  support@stock-ai.pro
                </a>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  {t("contactPage.responseTimeHeading", { defaultValue: "Response time" })}
                </p>
                <p className="mt-1 glass-muted text-sm">{t("contactPage.responseTimeHint")}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  {t("contactPage.socialLinks", { defaultValue: "Social links" })}
                </p>
                <div className="mt-2 flex flex-wrap gap-3 text-sm">
                  <a
                    href="https://www.linkedin.com/company/stock-ai-pro"
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-white/10 px-3 py-1.5 glass-muted transition hover:border-brandDark hover:text-white"
                  >
                    LinkedIn
                  </a>
                  <a
                    href="https://x.com/stockaipro"
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-white/10 px-3 py-1.5 glass-muted transition hover:border-brandDark hover:text-white"
                  >
                    X
                  </a>
                  <a
                    href="https://github.com/stock-ai-pro"
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-white/10 px-3 py-1.5 glass-muted transition hover:border-brandDark hover:text-white"
                  >
                    GitHub
                  </a>
                </div>
              </div>
            </div>
          </section>

          <section className="glass-section rounded-3xl p-6 shadow-sm md:p-8">
            <h2 className="text-xl font-semibold text-white">
              {t("contactPage.writeUsHeading", { defaultValue: "Write to us" })}
            </h2>
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="contact-name" className="mb-1 block text-sm font-medium text-white">
                  {t("contactPage.fullName", { defaultValue: "Full name" })}
                </label>
                <input
                  id="contact-name"
                  type="text"
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full rounded-lg border border-white/10 px-4 py-2.5 text-sm text-white outline-none transition focus:border-brandDark focus:ring-2 focus:ring-brandDark/20"
                />
              </div>

              <div>
                <label htmlFor="contact-email" className="mb-1 block text-sm font-medium text-white">
                  {t("privacyPageLayout.email", { defaultValue: "Email" })}
                </label>
                <input
                  id="contact-email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-lg border border-white/10 px-4 py-2.5 text-sm text-white outline-none transition focus:border-brandDark focus:ring-2 focus:ring-brandDark/20"
                />
              </div>

              <div>
                <label htmlFor="contact-subject" className="mb-1 block text-sm font-medium text-white">
                  {t("contactPage.subject", { defaultValue: "Topic" })}
                </label>
                <select
                  id="contact-subject"
                  required
                  value={subject}
                  onChange={(event) => setSubject(event.target.value as ContactSubjectValue)}
                  className="w-full rounded-lg glass-panel border border-white/10 px-4 py-2.5 text-sm text-white outline-none transition focus:border-brandDark focus:ring-2 focus:ring-brandDark/20"
                >
                  {subjectLabels.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="contact-message" className="mb-1 block text-sm font-medium text-white">
                  {t("contactPage.message", { defaultValue: "Message" })}
                </label>
                <textarea
                  id="contact-message"
                  required
                  minLength={20}
                  rows={6}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  className="w-full rounded-lg border border-white/10 px-4 py-2.5 text-sm text-white outline-none transition focus:border-brandDark focus:ring-2 focus:ring-brandDark/20"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
                style={{ backgroundColor: colors.brandDark }}
              >
                {submitting
                  ? t("contactPage.sending", { defaultValue: "Sending…" })
                  : t("contactPage.send", { defaultValue: "Send" })}
              </button>

              {successMessage ? <p className="text-sm font-medium text-positive">{successMessage}</p> : null}
              {errorMessage ? <p className="text-sm font-medium text-negative">{errorMessage}</p> : null}
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
