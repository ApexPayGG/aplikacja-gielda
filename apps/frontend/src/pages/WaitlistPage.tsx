import { FormEvent, useEffect, useMemo, useState } from "react";
import { SEOHead } from "../components/SEOHead";
import { getWaitlistCount, joinWaitlist, type WaitlistSource } from "../services/api";
import { colors } from "../styles/designSystem";
import { apiErrorMessage } from "../utils/apiErrorMessage";
import { useSearchParams } from "react-router-dom";

const EARLY_ACCESS_BENEFITS = [
  "Stała cena Early Adopter: Pro $9/mo na zawsze.",
  "Priorytetowy dostęp do nowych modułów AI.",
  "Wpływ na roadmapę produktu i funkcje premium.",
  "Dedykowane onboardingowe materiały dla pierwszych użytkowników.",
];

const ALLOWED_SOURCES: WaitlistSource[] = ["landing", "pricing", "signal"];

function parseSource(value: string | null): WaitlistSource | undefined {
  if (!value) return undefined;
  return ALLOWED_SOURCES.includes(value as WaitlistSource) ? (value as WaitlistSource) : undefined;
}

export function WaitlistPage() {
  const [searchParams] = useSearchParams();
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
        description="Dołącz do listy Early Access i odbierz cenę Early Adopter dla StockAI Pro."
      />

      <section
        className="px-6 py-16 md:py-20"
        style={{ backgroundImage: `linear-gradient(135deg, ${colors.brandDark} 0%, ${colors.brandMedium} 100%)` }}
      >
        <div className="mx-auto max-w-4xl">
          <h1 className="text-4xl font-bold text-white md:text-5xl">Dołącz do Early Access</h1>
          <p className="mt-4 max-w-2xl text-base text-white/90 md:text-lg">
            Pierwsze 500 kont otrzyma cenę Early Adopter na zawsze: Pro $9/mo
          </p>

          <div className="mt-8 glass-section p-6 shadow-lg md:p-8">
            {submitted ? (
              <p className="text-base font-semibold text-brandDark">Jesteś na liście! Sprawdź swoją skrzynkę.</p>
            ) : (
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="waitlist-name" className="mb-1 block text-sm font-medium text-textPrimary">
                    Imię (opcjonalne)
                  </label>
                  <input
                    id="waitlist-name"
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Twoje imię"
                    className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-textPrimary outline-none transition focus:border-brandDark focus:ring-2 focus:ring-brandDark/20"
                  />
                </div>

                <div>
                  <label htmlFor="waitlist-email" className="mb-1 block text-sm font-medium text-textPrimary">
                    Email
                  </label>
                  <input
                    id="waitlist-email"
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="twoj@email.com"
                    className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-textPrimary outline-none transition focus:border-brandDark focus:ring-2 focus:ring-brandDark/20"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
                  style={{ backgroundColor: colors.brandDark }}
                >
                  {submitting ? "Wysyłanie..." : "Dołącz do waitlisty"}
                </button>

                {error ? <p className="text-sm text-negative">{error}</p> : null}
              </form>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-12 md:py-16">
        <p className="text-lg font-semibold text-textPrimary">Już {count ?? "…"} osób czeka</p>

        <div className="mt-6 glass-section p-6 shadow-sm">
          <h2 className="text-xl font-bold text-textPrimary">Korzyści Early Access</h2>
          <ul className="mt-4 space-y-3">
            {EARLY_ACCESS_BENEFITS.map((benefit) => (
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
