import { useEffect } from "react";
import { Link } from "react-router-dom";
import { colors } from "../styles/designSystem";

const sections = [
  {
    title: "Usługa",
    body: "StockAI Pro udostępnia narzędzia analityczne, edukacyjne i symulacyjne wspierające proces podejmowania decyzji inwestycyjnych. Szczegółowy zakres funkcji może się zmieniać wraz z rozwojem produktu.",
  },
  {
    title: "Płatności",
    body: "Subskrypcje płatne są rozliczane cyklicznie przez zewnętrznego operatora płatności (Stripe). Opłata pobierana jest z góry za wybrany okres, a anulowanie wyłącza odnowienie kolejnego cyklu.",
  },
  {
    title: "Ograniczenia",
    body: "Użytkownik zobowiązuje się do korzystania z usługi zgodnie z prawem i regulaminem. Zabronione jest m.in. obchodzenie zabezpieczeń, udostępnianie konta osobom trzecim oraz nadużywanie infrastruktury aplikacji.",
  },
  {
    title: "Disclaimer inwestycyjny",
    body: "Materiały i sygnały dostępne w serwisie mają charakter informacyjny i edukacyjny. Nie stanowią rekomendacji inwestycyjnej ani porady finansowej. Każda decyzja inwestycyjna podejmowana jest na własną odpowiedzialność użytkownika.",
  },
];

export function TermsPage() {
  useEffect(() => {
    document.title = "Regulamin | StockAI Pro";
  }, []);

  return (
    <div
      className="min-h-screen bg-bgSecondary px-4 py-12 md:py-16"
      style={{ backgroundImage: `linear-gradient(180deg, ${colors.brandDark}08 0%, ${colors.bgSecondary} 35%)` }}
    >
      <div className="mx-auto max-w-4xl rounded-3xl border border-border bg-bgPrimary p-6 shadow-sm md:p-10">
        <div className="mb-8 border-b border-border pb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-brandCyan">Warunki korzystania</p>
          <h1 className="mt-2 text-3xl font-bold text-textPrimary">Regulamin użytkowania</h1>
          <p className="mt-3 text-sm text-textSecondary">
            To jest wersja robocza (placeholder) regulaminu. Uzupełnij ją o pełne dane podmiotu, jurysdykcję i finalne zapisy prawne przed publikacją produkcyjną.
          </p>
        </div>

        <div className="space-y-6">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-semibold text-textPrimary">{section.title}</h2>
              <p className="mt-2 text-sm leading-6 text-textSecondary">{section.body}</p>
            </section>
          ))}
        </div>

        <div className="mt-10 border-t border-border pt-6">
          <Link to="/" className="inline-flex items-center rounded-lg bg-brandDark px-4 py-2 text-sm font-semibold text-white transition hover:bg-brandMedium">
            Powrót na stronę główną
          </Link>
        </div>
      </div>
    </div>
  );
}
