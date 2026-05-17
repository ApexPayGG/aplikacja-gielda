import { useEffect } from "react";
import { Link } from "react-router-dom";
import { colors } from "../styles/designSystem";

const sections = [
  {
    title: "Dane osobowe",
    body: "Przetwarzamy wyłącznie dane niezbędne do świadczenia usługi (np. adres e-mail, identyfikator konta, informacje rozliczeniowe). Dane są przechowywane przez okres konieczny do realizacji celu przetwarzania oraz obowiązków prawnych.",
  },
  {
    title: "Cookies",
    body: "Używamy plików cookies i podobnych technologii do utrzymania sesji, analityki oraz poprawy jakości działania aplikacji. Możesz zarządzać preferencjami cookies z poziomu ustawień przeglądarki.",
  },
  {
    title: "Prawa użytkownika",
    body: "Zgodnie z RODO/GDPR masz prawo do dostępu do danych, sprostowania, usunięcia, ograniczenia przetwarzania, przenoszenia danych oraz sprzeciwu wobec przetwarzania. Masz także prawo wycofać zgodę w dowolnym momencie.",
  },
  {
    title: "Kontakt",
    body: "W sprawach związanych z prywatnością skontaktuj się z administratorem danych pod adresem: privacy@stockaipro.com. Odpowiadamy na zgłoszenia bez zbędnej zwłoki, zgodnie z wymogami RODO/GDPR.",
  },
];

export function PrivacyPage() {
  useEffect(() => {
    document.title = "Polityka prywatności | StockAI Pro";
  }, []);

  return (
    <div
      className="min-h-screen bg-bgSecondary px-4 py-12 md:py-16"
      style={{ backgroundImage: `linear-gradient(180deg, ${colors.brandDark}08 0%, ${colors.bgSecondary} 35%)` }}
    >
      <div className="mx-auto max-w-4xl rounded-3xl border border-border bg-bgPrimary p-6 shadow-sm md:p-10">
        <div className="mb-8 border-b border-border pb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-brandCyan">RODO / GDPR</p>
          <h1 className="mt-2 text-3xl font-bold text-textPrimary">Polityka prywatności</h1>
          <p className="mt-3 text-sm text-textSecondary">
            To jest wersja robocza (placeholder) polityki prywatności. Przed publikacją uzupełnij dane firmy, podstawy prawne i finalne dane kontaktowe.
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
