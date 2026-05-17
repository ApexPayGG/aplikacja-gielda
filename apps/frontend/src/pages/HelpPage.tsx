import { useMemo, useState } from "react";
import { SEOHead } from "../components/SEOHead";
import { colors } from "../styles/designSystem";

type HelpCategory = {
  icon: string;
  title: string;
};

type FaqItem = {
  question: string;
  answer: string;
};

const categories: HelpCategory[] = [
  { icon: "🚀", title: "Pierwsze kroki" },
  { icon: "💳", title: "Płatności i subskrypcja" },
  { icon: "📊", title: "Sygnały i analiza" },
  { icon: "🤖", title: "AI i Behavioral Coach" },
];

const faqItems: FaqItem[] = [
  {
    question: "Jak zacząć korzystać z StockAI Pro?",
    answer:
      "Załóż konto, przejdź onboarding i wybierz interesujące Cię moduły. Następnie skonfiguruj preferencje sygnałów oraz rozpocznij pracę od Dashboardu.",
  },
  {
    question: "Czym różni się Free od Pro?",
    answer:
      "Plan Free daje dostęp do podstawowych narzędzi i ograniczonej liczby analiz. Plan Pro odblokowuje zaawansowane moduły AI, więcej sygnałów oraz rozszerzone raporty.",
  },
  {
    question: "Jak działa Paper Trading?",
    answer:
      "Paper Trading pozwala testować decyzje inwestycyjne na wirtualnym kapitale. Symulujesz transakcje bez ryzyka finansowego i analizujesz wyniki jak na realnym rynku.",
  },
  {
    question: "Co to jest Behavioral Coach?",
    answer:
      "Behavioral Coach analizuje Twoje nawyki inwestycyjne i podpowiada, jak ograniczyć błędy emocjonalne. Otrzymujesz konkretne wskazówki dopasowane do Twojego stylu.",
  },
  {
    question: "Jak podpiąć konto eToro?",
    answer:
      "Przejdź do Ustawień, sekcji Brokers i wybierz kartę eToro. Po kliknięciu CTA przejdziesz przez proces połączenia konta oraz autoryzacji.",
  },
  {
    question: "Jak działają sygnały AI?",
    answer:
      "Sygnały AI łączą dane rynkowe, sentyment i kontekst zachowania ceny. Każdy sygnał zawiera scoring, uzasadnienie oraz sugerowany poziom ryzyka.",
  },
  {
    question: "Czy mogę anulować subskrypcję?",
    answer:
      "Tak. Subskrypcję możesz anulować w dowolnym momencie z poziomu ustawień płatności. Dostęp do funkcji Pro pozostanie aktywny do końca opłaconego okresu.",
  },
  {
    question: "Jak resetować hasło?",
    answer:
      "Wejdź na stronę logowania i kliknij „Nie pamiętasz hasła?”. Otrzymasz e-mail z linkiem do ustawienia nowego hasła.",
  },
  {
    question: "Co to jest Pre-Mortem AI?",
    answer:
      "Pre-Mortem AI to moduł, który symuluje potencjalne scenariusze porażki przed wejściem w transakcję. Pomaga ocenić ryzyko i przygotować plan działania.",
  },
  {
    question: "Jak działa Premium Analysis?",
    answer:
      "Premium Analysis dostarcza pogłębione raporty spółek: czynniki fundamentalne, ryzyka branżowe i scenariusze cenowe. To rozszerzona warstwa analityczna dla planu Pro.",
  },
];

export function HelpPage() {
  const [searchValue, setSearchValue] = useState("");
  const [openQuestion, setOpenQuestion] = useState<string | null>(faqItems[0]?.question ?? null);

  const filteredFaq = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();
    if (!normalizedSearch) return faqItems;
    return faqItems.filter((item) => {
      const content = `${item.question} ${item.answer}`.toLowerCase();
      return content.includes(normalizedSearch);
    });
  }, [searchValue]);

  return (
    <div className="min-h-screen bg-bgSecondary px-4 py-10 text-textPrimary">
      <SEOHead
        title="Centrum pomocy | StockAI Pro"
        description="Najczęściej zadawane pytania, kategorie pomocy i kontakt do zespołu wsparcia StockAI Pro."
        ogType="website"
      />

      <div className="mx-auto max-w-5xl space-y-8">
        <header className="rounded-2xl border bg-bgPrimary p-6 shadow-sm" style={{ borderColor: colors.border }}>
          <h1 className="text-3xl font-bold">Centrum pomocy</h1>
          <p className="mt-2 text-sm text-textSecondary">
            Wszystko, czego potrzebujesz, żeby sprawnie korzystać z platformy StockAI Pro.
          </p>

          <label htmlFor="help-search" className="mt-5 block text-sm font-medium text-textSecondary">
            Szukaj w FAQ
          </label>
          <input
            id="help-search"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Wpisz pytanie lub słowo kluczowe..."
            className="mt-2 w-full rounded-xl border border-borderStrong bg-bgPrimary px-4 py-3 text-sm text-textPrimary outline-none transition focus:border-brandCyan focus:ring-2 focus:ring-brandCyan/30"
          />
        </header>

        <section aria-labelledby="help-categories" className="space-y-4">
          <h2 id="help-categories" className="text-xl font-semibold">
            Kategorie
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {categories.map((category) => (
              <article
                key={category.title}
                className="rounded-2xl border bg-bgPrimary p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                style={{ borderColor: colors.border }}
              >
                <p className="text-2xl">{category.icon}</p>
                <h3 className="mt-3 text-base font-semibold text-textPrimary">{category.title}</h3>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="help-faq" className="space-y-4">
          <h2 id="help-faq" className="text-xl font-semibold">
            FAQ
          </h2>

          <div className="space-y-3">
            {filteredFaq.map((item) => {
              const isOpen = openQuestion === item.question;
              return (
                <article key={item.question} className="overflow-hidden rounded-2xl border bg-bgPrimary" style={{ borderColor: colors.border }}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                    onClick={() => setOpenQuestion(isOpen ? null : item.question)}
                    aria-expanded={isOpen}
                  >
                    <span className="font-medium text-textPrimary">{item.question}</span>
                    <span className="text-2xl leading-none" style={{ color: colors.brandCyan }} aria-hidden="true">
                      {isOpen ? "-" : "+"}
                    </span>
                  </button>
                  {isOpen ? <p className="border-t px-5 py-4 text-sm text-textSecondary" style={{ borderColor: colors.border }}>{item.answer}</p> : null}
                </article>
              );
            })}

            {filteredFaq.length === 0 ? (
              <p className="rounded-xl border bg-bgPrimary px-4 py-3 text-sm text-textSecondary" style={{ borderColor: colors.border }}>
                Brak wyników dla podanego zapytania. Spróbuj użyć innego słowa kluczowego.
              </p>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border bg-bgPrimary p-6 text-center shadow-sm" style={{ borderColor: colors.border }}>
          <h2 className="text-2xl font-semibold text-textPrimary">Nie znalazłeś odpowiedzi?</h2>
          <p className="mt-2 text-sm text-textSecondary">
            Napisz do nas na{" "}
            <a href="mailto:support@stock-ai.pro" className="font-semibold underline" style={{ color: colors.brandDark }}>
              support@stock-ai.pro
            </a>
          </p>
          <a
            href="mailto:support@stock-ai.pro"
            className="mt-5 inline-flex rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
            style={{ backgroundColor: colors.brandDark }}
          >
            Napisz do nas
          </a>
        </section>
      </div>
    </div>
  );
}
