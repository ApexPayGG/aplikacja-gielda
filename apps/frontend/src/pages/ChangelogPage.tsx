import { SEOHead } from "../components/SEOHead";
import { colors } from "../styles/designSystem";

type ChangelogCategory = "launch" | "feature" | "fix" | "security";

type ChangelogEntry = {
  version: string;
  date: string;
  title: string;
  category: ChangelogCategory;
  changes: string[];
};

const CATEGORY_BADGES: Record<ChangelogCategory, string> = {
  launch: "🚀 Launch",
  feature: "✨ Feature",
  fix: "🐛 Fix",
  security: "🔒 Security",
};

const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    version: "v1.0.0",
    date: "May 2026",
    title: "Launch 🚀",
    category: "launch",
    changes: [
      "Platforma inwestycyjna AI dla GPW, NYSE, DAX i 130+ giełd",
      "27 modułów AI (sygnały, behavioral coach, paper trading)",
      "9 języków",
      "Integracja Alpaca (US trading)",
      "eToro affiliate",
    ],
  },
  {
    version: "v0.9.0",
    date: "May 2026",
    title: "Premium Analysis",
    category: "feature",
    changes: [
      "5-ekranowe Premium Company Analysis",
      "Historical Twin (pgvector)",
      "Trader Psyche System",
      "Stripe payments",
    ],
  },
  {
    version: "v0.8.0",
    date: "April 2026",
    title: "Behavioral Layer",
    category: "feature",
    changes: ["Behavioral Coach", "Pre-Mortem AI", "Strategy DNA Match", "Loss Streak Cool-Down"],
  },
];

export function ChangelogPage() {
  return (
    <div className="min-h-screen bg-bgSecondary px-4 py-10 text-white md:px-6">
      <SEOHead
        title="StockAI Pro Changelog"
        description="Najnowsze funkcje i poprawki w StockAI Pro."
        ogType="website"
      />
      <div className="mx-auto max-w-4xl">
        <header className="mb-10">
          <h1 className="text-4xl font-bold md:text-5xl" style={{ color: colors.brandDark }}>
            Co nowego
          </h1>
          <p className="mt-3 text-lg" style={{ color: colors.textSecondary }}>
            Najnowsze funkcje i poprawki
          </p>
        </header>

        <section aria-label="Changelog timeline" className="relative space-y-8 pl-8">
          <div
            className="pointer-events-none absolute bottom-0 left-2 top-0 w-0.5"
            style={{ backgroundColor: colors.brandCyan }}
          />

          {CHANGELOG_ENTRIES.map((entry) => (
            <article
              key={entry.version}
              className="relative rounded-2xl border bg-bgPrimary p-6 shadow-sm"
              style={{ borderColor: colors.border }}
            >
              <span
                className="absolute -left-[1.65rem] top-8 block h-4 w-4 rounded-full border-2 bg-bgPrimary"
                style={{ borderColor: colors.brandCyan }}
                aria-hidden="true"
              />

              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span
                  className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white"
                  style={{ backgroundColor: colors.brandDark }}
                >
                  {entry.version}
                </span>
                <span
                  className="rounded-full border px-3 py-1 text-xs font-semibold"
                  style={{ borderColor: colors.borderStrong, color: colors.textSecondary }}
                >
                  {CATEGORY_BADGES[entry.category]}
                </span>
              </div>

              <p className="text-sm font-medium" style={{ color: colors.textMuted }}>
                {entry.date}
              </p>
              <h2 className="mt-1 text-2xl font-bold" style={{ color: colors.textPrimary }}>
                {entry.title}
              </h2>

              <ul className="mt-4 list-disc space-y-2 pl-5" style={{ color: colors.textSecondary }}>
                {entry.changes.map((change) => (
                  <li key={change}>{change}</li>
                ))}
              </ul>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
