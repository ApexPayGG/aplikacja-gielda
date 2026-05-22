import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { SEOHead } from "../components/SEOHead";
import { colors } from "../styles/designSystem";

type ChangelogCategory = "launch" | "feature" | "fix" | "security";

type ChangelogEntry = {
  version: string;
  dateKey: string;
  titleKey: string;
  category: ChangelogCategory;
  bodyKeys: string[];
};

const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    version: "v1.0.0",
    dateKey: "changelogPage.dateMay2026",
    titleKey: "changelogPage.v100Title",
    category: "launch",
    bodyKeys: [
      "changelogPage.v100change1",
      "changelogPage.v100change2",
      "changelogPage.v100change3",
      "changelogPage.v100change4",
      "changelogPage.v100change5",
    ],
  },
  {
    version: "v0.9.0",
    dateKey: "changelogPage.dateMay2026",
    titleKey: "changelogPage.v090Title",
    category: "feature",
    bodyKeys: [
      "changelogPage.v090change1",
      "changelogPage.v090change2",
      "changelogPage.v090change3",
      "changelogPage.v090change4",
    ],
  },
  {
    version: "v0.8.0",
    dateKey: "changelogPage.dateApril2026",
    titleKey: "changelogPage.v080Title",
    category: "feature",
    bodyKeys: [
      "changelogPage.v080change1",
      "changelogPage.v080change2",
      "changelogPage.v080change3",
      "changelogPage.v080change4",
    ],
  },
];

export function ChangelogPage() {
  const { t } = useTranslation();

  const categoryBadges = useMemo(
    (): Record<ChangelogCategory, string> => ({
      launch: t("changelogPage.badgeLaunch", { defaultValue: "🚀 Launch" }),
      feature: t("changelogPage.badgeFeature", { defaultValue: "✨ Feature" }),
      fix: t("changelogPage.badgeFix", { defaultValue: "🐛 Fix" }),
      security: t("changelogPage.badgeSecurity", { defaultValue: "🔒 Security" }),
    }),
    [t],
  );

  return (
    <div className="min-h-screen bg-bgSecondary px-4 py-10 text-white md:px-6">
      <SEOHead
        title="StockAI Pro Changelog"
        description={t("changelogPage.seoDescription", {
          defaultValue: "Latest features and fixes in StockAI Pro.",
        })}
        ogType="website"
      />
      <div className="mx-auto max-w-4xl">
        <header className="mb-10">
          <h1 className="text-4xl font-bold md:text-5xl" style={{ color: colors.brandDark }}>
            {t("changelogPage.title", { defaultValue: "What's new" })}
          </h1>
          <p className="mt-3 text-lg" style={{ color: colors.textSecondary }}>
            {t("changelogPage.subtitle", {
              defaultValue: "Latest features and fixes",
            })}
          </p>
        </header>

        <section aria-label={t("changelogPage.title", { defaultValue: "Changelog timeline" })} className="relative space-y-8 pl-8">
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
                  {categoryBadges[entry.category]}
                </span>
              </div>

              <p className="text-sm font-medium" style={{ color: colors.textMuted }}>
                {t(entry.dateKey)}
              </p>
              <h2 className="mt-1 text-2xl font-bold" style={{ color: colors.textPrimary }}>
                {t(entry.titleKey)}
              </h2>

              <ul className="mt-4 list-disc space-y-2 pl-5" style={{ color: colors.textSecondary }}>
                {entry.bodyKeys.map((key) => (
                  <li key={key}>{t(key)}</li>
                ))}
              </ul>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
