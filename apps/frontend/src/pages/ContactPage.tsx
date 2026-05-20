import { FormEvent, useEffect, useState } from "react";
import { sendContactMessage } from "../services/api";
import { colors } from "../styles/designSystem";

const SUBJECT_OPTIONS = ["Płatności", "Bug", "Sugestia", "Inne"] as const;

type ContactSubject = (typeof SUBJECT_OPTIONS)[number];

export function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState<ContactSubject>("Płatności");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Kontakt | StockAI Pro";
  }, []);

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
      setSuccessMessage("Wiadomość wysłana! Odpiszemy w ciągu 24h.");
      setName("");
      setEmail("");
      setSubject("Płatności");
      setMessage("");
    } catch {
      setErrorMessage("Coś poszło nie tak. Spróbuj ponownie.");
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
          <h1 className="text-4xl font-bold text-white md:text-5xl">Kontakt</h1>
          <p className="mt-3 max-w-2xl text-base glass-muted md:text-lg">
            Masz pytanie o StockAI Pro? Napisz do nas — wrócimy z odpowiedzią maksymalnie w 24h.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="glass-section rounded-3xl p-6 shadow-sm md:p-8">
            <h2 className="text-xl font-semibold text-white">Informacje kontaktowe</h2>
            <div className="mt-6 space-y-5">
              <div>
                <p className="text-sm font-semibold text-white">Email</p>
                <a href="mailto:support@stock-ai.pro" className="mt-1 inline-block text-sm text-white hover:underline">
                  support@stock-ai.pro
                </a>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Czas odpowiedzi</p>
                <p className="mt-1 glass-muted text-sm">Odpowiadamy w ciągu 24h</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Social links</p>
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
            <h2 className="text-xl font-semibold text-white">Napisz do nas</h2>
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="contact-name" className="mb-1 block text-sm font-medium text-white">
                  Imię i nazwisko
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
                  Email
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
                  Temat
                </label>
                <select
                  id="contact-subject"
                  required
                  value={subject}
                  onChange={(event) => setSubject(event.target.value as ContactSubject)}
                  className="w-full rounded-lg glass-panel border border-white/10 px-4 py-2.5 text-sm text-white outline-none transition focus:border-brandDark focus:ring-2 focus:ring-brandDark/20"
                >
                  {SUBJECT_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="contact-message" className="mb-1 block text-sm font-medium text-white">
                  Wiadomość
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
                {submitting ? "Wysyłanie..." : "Wyślij"}
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
