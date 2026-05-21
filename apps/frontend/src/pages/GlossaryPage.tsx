import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  GLASS_HERO,
  GLASS_INPUT,
  GLASS_PAGE_BG,
  GLASS_PAGE_SUBTITLE,
  GLASS_PAGE_TITLE,
  GLASS_SECTION,
} from "../components/behavioral-coach/glassStyles";

type GlossaryCategoryId = "technical" | "fundamental" | "psychological" | "broker";

type GlossaryEntry = {
  term: string;
  definition: string;
  category: GlossaryCategoryId;
};

const CATEGORY_IDS: readonly GlossaryCategoryId[] = ["technical", "fundamental", "psychological", "broker"];

const GLOSSARY_ENTRIES: readonly GlossaryEntry[] = [
  {
    term: "Bid-Ask Spread",
    definition: "The gap between the best bid and ask price. A tighter spread usually means higher liquidity.",
    category: "broker",
  },
  {
    term: "Breakout",
    definition: "Price moves above resistance or below support, often signaling a stronger trend leg.",
    category: "technical",
  },
  {
    term: "Diversification",
    definition: "Spreading capital across assets to limit single-position risk.",
    category: "fundamental",
  },
  {
    term: "EBITDA",
    definition: "Earnings before interest, taxes, depreciation, and amortization — an operating profit proxy.",
    category: "fundamental",
  },
  {
    term: "FOMO",
    definition: "Fear of missing out — pressure to enter a trade because others are participating.",
    category: "psychological",
  },
  {
    term: "Leverage",
    definition: "Borrowed exposure that magnifies both gains and losses relative to margin posted.",
    category: "broker",
  },
  {
    term: "MACD",
    definition: "Momentum indicator based on moving averages; used to gauge trend direction and strength.",
    category: "technical",
  },
  {
    term: "Margin Call",
    definition: "Broker request to add collateral when account equity falls below required levels.",
    category: "broker",
  },
  {
    term: "Overtrading",
    definition: "Excessive trading driven by emotion, often hurting long-term results.",
    category: "psychological",
  },
  {
    term: "P/E",
    definition: "Price-to-earnings ratio — share price divided by earnings per share for valuation context.",
    category: "fundamental",
  },
  {
    term: "RSI",
    definition: "Relative Strength Index — oscillator highlighting potential overbought or oversold zones.",
    category: "technical",
  },
  {
    term: "Stop Loss",
    definition: "Protective order that closes a position after a predefined loss threshold.",
    category: "psychological",
  },
];

const CATEGORY_LABEL_KEYS: Record<GlossaryCategoryId, { key: string; defaultValue: string }> = {
  technical: { key: "glossaryPage.catTechnical", defaultValue: "Technical" },
  fundamental: { key: "glossaryPage.catFundamental", defaultValue: "Fundamental" },
  psychological: { key: "glossaryPage.catPsychological", defaultValue: "Psychological" },
  broker: { key: "glossaryPage.catBroker", defaultValue: "Broker" },
};

export function GlossaryPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<GlossaryCategoryId | null>(null);

  const groupedEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const filteredEntries = GLOSSARY_ENTRIES.filter((entry) => {
      const matchesCategory = !activeCategory || entry.category === activeCategory;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        entry.term.toLowerCase().includes(normalizedQuery) ||
        entry.definition.toLowerCase().includes(normalizedQuery);

      return matchesCategory && matchesQuery;
    }).sort((a, b) => a.term.localeCompare(b.term, "en"));

    return filteredEntries.reduce<Record<string, GlossaryEntry[]>>((acc, entry) => {
      const firstLetter = entry.term.charAt(0).toUpperCase();
      acc[firstLetter] ??= [];
      acc[firstLetter].push(entry);
      return acc;
    }, {});
  }, [activeCategory, query]);

  const alphabet = Object.keys(groupedEntries);

  return (
    <div className={`${GLASS_PAGE_BG} px-4 py-10`}>
      <div className="mx-auto max-w-6xl">
        <header className={GLASS_HERO}>
          <h1 className={GLASS_PAGE_TITLE}>{t("glossaryPage.title", { defaultValue: "Financial Glossary" })}</h1>
          <p className={`${GLASS_PAGE_SUBTITLE} mt-2 max-w-2xl`}>
            {t("glossaryPage.subtitle", {
              defaultValue: "Key investing terms in one place — search quickly and learn market language.",
            })}
          </p>
        </header>

        <section className={`${GLASS_SECTION} mt-8`}>
          <label htmlFor="glossary-search" className="mb-2 block text-sm font-medium text-white/70">
            {t("glossaryPage.searchLabel", { defaultValue: "Search term" })}
          </label>
          <input
            id="glossary-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("glossaryPage.searchPlaceholder", { defaultValue: "e.g. RSI, P/E, stop loss..." })}
            className={GLASS_INPUT}
          />

          <div className="mt-4 flex flex-wrap gap-2">
            {CATEGORY_IDS.map((categoryId) => {
              const isActive = activeCategory === categoryId;
              const label = CATEGORY_LABEL_KEYS[categoryId];

              return (
                <button
                  key={categoryId}
                  type="button"
                  onClick={() => setActiveCategory((prev) => (prev === categoryId ? null : categoryId))}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                    isActive
                      ? "border-[#a855f7]/50 bg-[#a855f7]/20 text-[#22d3ee]"
                      : "border-white/15 bg-white/5 text-white/70 hover:border-white/25"
                  }`}
                >
                  {t(label.key, { defaultValue: label.defaultValue })}
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-8 space-y-8">
          {alphabet.length === 0 ? (
            <p className={`${GLASS_SECTION} text-sm text-white/60`}>
              {t("glossaryPage.empty", { defaultValue: "No results for the selected filters." })}
            </p>
          ) : (
            alphabet.map((letter) => (
              <div key={letter}>
                <h2 className="mb-3 text-lg font-semibold text-white">{letter}</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {groupedEntries[letter].map((entry) => (
                    <article key={entry.term} className={GLASS_SECTION}>
                      <h3 className="text-base font-bold text-white">{entry.term}</h3>
                      <p className="mt-2 text-sm leading-6 text-white/65">{entry.definition}</p>
                    </article>
                  ))}
                </div>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
