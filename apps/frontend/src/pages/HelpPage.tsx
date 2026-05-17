import { useEffect } from "react";
import { Link } from "react-router-dom";
import { colors } from "../styles/designSystem";

const HELP_ITEMS = [
  "Sprawdź najpierw sekcję Pricing i FAQ na landing page.",
  "Jeśli problem dotyczy konta, podaj email użyty przy rejestracji.",
  "Dla błędów technicznych dołącz krótki opis i kroki odtworzenia.",
];

export function HelpPage() {
  useEffect(() => {
    document.title = "Pomoc | StockAI Pro";
  }, []);

  return (
    <div
      className="min-h-screen bg-bgSecondary px-4 py-12 md:py-16"
      style={{ backgroundImage: `linear-gradient(180deg, ${colors.brandDark}08 0%, ${colors.bgSecondary} 35%)` }}
    >
      <div className="mx-auto max-w-4xl rounded-3xl border border-border bg-bgPrimary p-6 shadow-sm md:p-10">
        <p className="text-xs font-semibold uppercase tracking-wide text-brandCyan">Support</p>
        <h1 className="mt-2 text-3xl font-bold text-textPrimary">Help</h1>
        <p className="mt-3 text-sm text-textSecondary">
          Potrzebujesz wsparcia? Skorzystaj z poniższych wskazówek i wyślij do nas wiadomość.
        </p>

        <ul className="mt-6 space-y-3 text-sm text-textSecondary">
          {HELP_ITEMS.map((item) => (
            <li key={item} className="flex items-start gap-3">
              <span className="mt-0.5 text-brandCyan">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <div className="mt-8 border-t border-border pt-6">
          <Link
            to="/contact"
            className="inline-flex rounded-lg bg-brandDark px-4 py-2 text-sm font-semibold text-white transition hover:bg-brandMedium"
          >
            Skontaktuj się z nami
          </Link>
        </div>
      </div>
    </div>
  );
}
