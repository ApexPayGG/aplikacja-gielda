import { useMemo, useState } from "react";
import { colors } from "../styles/designSystem";

type GlossaryCategory = "Techniczna" | "Fundamentalna" | "Psychologiczna" | "Broker";

type GlossaryEntry = {
  term: string;
  definition: string;
  category: GlossaryCategory;
};

const CATEGORIES: readonly GlossaryCategory[] = ["Techniczna", "Fundamentalna", "Psychologiczna", "Broker"];

const GLOSSARY_ENTRIES: readonly GlossaryEntry[] = [
  {
    term: "Bid-Ask Spread",
    definition: "Różnica między najlepszą ceną kupna i sprzedaży. Im mniejszy spread, tym zwykle wyższa płynność.",
    category: "Broker",
  },
  {
    term: "Breakout",
    definition: "Wybicie ceny ponad opór lub poniżej wsparcia, często sygnalizujące rozpoczęcie silniejszego ruchu.",
    category: "Techniczna",
  },
  {
    term: "Dywersyfikacja",
    definition: "Rozłożenie kapitału pomiędzy różne aktywa w celu ograniczania ryzyka pojedynczej pozycji.",
    category: "Fundamentalna",
  },
  {
    term: "EBITDA",
    definition: "Wskaźnik zysku operacyjnego przed odsetkami, podatkami, amortyzacją i deprecjacją.",
    category: "Fundamentalna",
  },
  {
    term: "FOMO",
    definition: "Fear Of Missing Out - presja wejścia w pozycję z obawy przed utratą okazji inwestycyjnej.",
    category: "Psychologiczna",
  },
  {
    term: "Leverage",
    definition: "Dźwignia finansowa pozwalająca otworzyć większą pozycję przy mniejszym depozycie, zwiększając zysk i ryzyko.",
    category: "Broker",
  },
  {
    term: "MACD",
    definition: "Wskaźnik momentum oparty o średnie kroczące, używany do oceny kierunku i siły trendu.",
    category: "Techniczna",
  },
  {
    term: "Margin Call",
    definition: "Wezwanie brokera do uzupełnienia depozytu, gdy wartość zabezpieczenia spada poniżej wymaganego poziomu.",
    category: "Broker",
  },
  {
    term: "Overtrading",
    definition: "Zbyt częste zawieranie transakcji pod wpływem emocji, zwykle prowadzące do pogorszenia wyników.",
    category: "Psychologiczna",
  },
  {
    term: "P/E",
    definition: "Price to Earnings - relacja ceny akcji do zysku na akcję, używana w wycenie spółek.",
    category: "Fundamentalna",
  },
  {
    term: "RSI",
    definition: "Relative Strength Index - oscylator wskazujący potencjalne strefy wykupienia i wyprzedania.",
    category: "Techniczna",
  },
  {
    term: "Stop Loss",
    definition: "Zlecenie zabezpieczające, które automatycznie zamyka pozycję po osiągnięciu określonego poziomu straty.",
    category: "Psychologiczna",
  },
];

export function GlossaryPage() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<GlossaryCategory | null>(null);

  const groupedEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const filteredEntries = GLOSSARY_ENTRIES.filter((entry) => {
      const matchesCategory = !activeCategory || entry.category === activeCategory;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        entry.term.toLowerCase().includes(normalizedQuery) ||
        entry.definition.toLowerCase().includes(normalizedQuery);

      return matchesCategory && matchesQuery;
    }).sort((a, b) => a.term.localeCompare(b.term, "pl"));

    return filteredEntries.reduce<Record<string, GlossaryEntry[]>>((acc, entry) => {
      const firstLetter = entry.term.charAt(0).toUpperCase();
      acc[firstLetter] ??= [];
      acc[firstLetter].push(entry);
      return acc;
    }, {});
  }, [activeCategory, query]);

  const alphabet = Object.keys(groupedEntries);

  return (
    <div className="relative min-h-screen overflow-hidden bg-bgSecondary px-4 py-10">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72"
        style={{
          background: `linear-gradient(165deg, ${colors.brandDark}14 0%, ${colors.brandDark}00 70%)`,
        }}
      />

      <div className="relative z-10 mx-auto max-w-6xl">
        <header className="mb-8">
          <h1 className="glass-page-title text-4xl">Słownik finansowy</h1>
          <p className="mt-2 max-w-2xl glass-muted text-sm">
            Najważniejsze pojęcia inwestycyjne zebrane w jednym miejscu - szybko wyszukuj terminy i ucz się języka
            rynku.
          </p>
        </header>

        <section className="glass-section rounded-2xl p-5 shadow-sm">
          <label htmlFor="glossary-search" className="mb-2 block text-sm font-medium glass-muted">
            Szukaj terminu
          </label>
          <input
            id="glossary-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Np. RSI, P/E, stop loss..."
            className="w-full glass-panel rounded-xl px-4 py-3 text-white outline-none transition focus:border-brandCyan focus:ring-2 focus:ring-brandCyan/25"
          />

          <div className="mt-4 flex flex-wrap gap-2">
            {CATEGORIES.map((category) => {
              const isActive = activeCategory === category;

              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory((prev) => (prev === category ? null : category))}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                    isActive
                      ? "border-brandDark bg-brandDark text-white"
                      : "border-white/20 bg-bgPrimary glass-muted hover:border-brandDark hover:text-white"
                  }`}
                >
                  {category}
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-8 space-y-8">
          {alphabet.length === 0 ? (
            <p className="glass-panel rounded-xl px-4 py-3 glass-muted text-sm">
              Brak wyników dla podanych filtrów.
            </p>
          ) : (
            alphabet.map((letter) => (
              <div key={letter}>
                <h2 className="mb-3 text-lg font-semibold text-white">{letter}</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {groupedEntries[letter].map((entry) => (
                    <article
                      key={entry.term}
                      className="glass-panel rounded-xl p-4 shadow-[0_6px_20px_rgba(13,13,26,0.06)]"
                    >
                      <h3 className="text-base font-bold text-white">{entry.term}</h3>
                      <p className="mt-2 text-sm leading-6 glass-muted">{entry.definition}</p>
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
