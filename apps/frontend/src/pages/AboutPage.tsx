import { SEOHead } from "../components/SEOHead";
import { colors } from "../styles/designSystem";

const missionValues = [
  {
    icon: "🎯",
    title: "Precyzja",
    description: "AI analizy oparte na danych, nie opiniach",
  },
  {
    icon: "🧠",
    title: "Psychologia",
    description: "Behavioral coaching jako fundament, nie dodatek",
  },
  {
    icon: "🌍",
    title: "Dostępność",
    description: "9 języków, 130+ giełd, od $0",
  },
] as const;

const stackBadges = ["React", "Node.js", "Claude AI", "TimescaleDB", "Alpaca"] as const;

const contactBadges = [
  { label: "LinkedIn", href: "https://www.linkedin.com/" },
  { label: "GitHub", href: "https://github.com/" },
] as const;

export function AboutPage() {
  return (
    <div className="min-h-screen bg-bgPrimary text-textPrimary">
      <SEOHead
        title="O StockAI Pro"
        description="Poznaj misję, wartości i twórcę StockAI Pro."
        ogType="website"
      />

      <section
        className="py-20 text-white md:py-24"
        style={{ backgroundImage: `linear-gradient(120deg, ${colors.brandDark}, ${colors.brandMedium})` }}
      >
        <div className="mx-auto max-w-6xl px-6">
          <h1 className="text-4xl font-bold md:text-5xl">O StockAI Pro</h1>
          <p className="mt-4 max-w-2xl text-base text-white/90 md:text-lg">
            Budujemy narzędzie które chcielibyśmy sami mieć
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14 md:py-16">
        <h2 className="text-3xl font-bold" style={{ color: colors.brandDark }}>
          Misja
        </h2>
        <p className="mt-4 max-w-3xl text-base leading-7 text-textSecondary">
          Naszą misją jest demokratyzacja profesjonalnych narzędzi inwestycyjnych. Retail inwestor zasługuje na takie
          same analizy jak instytucje.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {missionValues.map((value) => (
            <article
              key={value.title}
              className="rounded-2xl border bg-bgPrimary p-6 shadow-sm"
              style={{ borderColor: colors.border }}
            >
              <div className="mb-4 text-3xl" style={{ color: colors.brandCyan }}>
                {value.icon}
              </div>
              <h3 className="text-lg font-semibold text-textPrimary">{value.title}</h3>
              <p className="mt-2 text-sm leading-6 text-textSecondary">{value.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-bgSecondary py-14 md:py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-3xl font-bold" style={{ color: colors.brandDark }}>
            Twórca
          </h2>
          <div className="mt-8 rounded-2xl border border-border bg-bgPrimary p-6 shadow-sm md:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-start">
              <div
                className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full text-2xl font-bold text-white"
                style={{ backgroundColor: colors.brandDark }}
                aria-label="Avatar MC"
              >
                MC
              </div>
              <div>
                <h3 className="text-2xl font-bold text-textPrimary">Marcin Chłędzik</h3>
                <p className="mt-1 font-medium" style={{ color: colors.brandMedium }}>
                  Founder & CEO
                </p>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-textSecondary">
                  CEO AMC Energy, inwestor od 10 lat. StockAI Pro to narzędzie które sam chciałem mieć.
                </p>
                <a
                  href="https://www.linkedin.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex text-sm font-semibold transition-opacity hover:opacity-80"
                  style={{ color: colors.brandCyan }}
                >
                  LinkedIn
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14 md:py-16">
        <h2 className="text-3xl font-bold" style={{ color: colors.brandDark }}>
          Stack technologiczny
        </h2>
        <div className="mt-8 flex flex-wrap gap-3">
          {stackBadges.map((badge) => (
            <span
              key={badge}
              className="inline-flex rounded-full px-4 py-2 text-sm font-semibold text-white"
              style={{ backgroundColor: colors.brandDark }}
            >
              {badge}
            </span>
          ))}
        </div>
      </section>

      <section className="border-t border-border bg-bgSecondary py-14 md:py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-3xl font-bold" style={{ color: colors.brandDark }}>
            Kontakt
          </h2>
          <a
            href="mailto:marcin.chledzik@amcenergy.pl"
            className="mt-4 inline-flex text-base font-medium text-textSecondary transition hover:text-brandDark"
          >
            marcin.chledzik@amcenergy.pl
          </a>
          <div className="mt-6 flex flex-wrap gap-3">
            {contactBadges.map((badge) => (
              <a
                key={badge.label}
                href={badge.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex rounded-full border px-4 py-2 text-sm font-semibold transition hover:border-brandDark hover:text-brandDark"
                style={{ borderColor: colors.borderStrong, color: colors.textSecondary }}
              >
                {badge.label}
              </a>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
