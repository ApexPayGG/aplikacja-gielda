import type { LegalSection } from "../components/legal/LegalAccordion";
import { COMPANY_ADDRESS_LINE, COMPANY_LEGAL } from "../constants/companyLegal";

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export const termsSections: LegalSection[] = [
  {
    id: "definitions",
    title: "1. Definicje",
    defaultOpen: true,
    content: (
      <BulletList
        items={[
          '"Platforma" = stock-ai.pro i aplikacja StockAI Pro',
          '"Użytkownik" = osoba korzystająca z Platformy',
          '"Usługi" = analizy AI, coaching behawioralny, paper trading, sygnały',
          `"Operator" = ${COMPANY_LEGAL.name}, ${COMPANY_ADDRESS_LINE}`,
        ]}
      />
    ),
  },
  {
    id: "nature",
    title: "2. Charakter usług — najważniejsze",
    content: (
      <div className="space-y-3 rounded-xl border border-amber-400/30 bg-amber-500/5 p-4 text-textPrimary">
        <p>StockAI Pro świadczy wyłącznie usługi edukacyjne i informacyjne.</p>
        <p className="font-medium">Platforma NIE jest:</p>
        <BulletList
          items={[
            "doradcą inwestycyjnym w rozumieniu Ustawy o obrocie instrumentami finansowymi",
            "brokerem ani domem maklerskim",
            "usługą zarządzania aktywami",
          ]}
        />
        <p>
          Wszelkie analizy, sygnały i rekomendacje generowane przez systemy AI mają charakter wyłącznie informacyjny.
          Użytkownik podejmuje decyzje inwestycyjne na własną odpowiedzialność.
        </p>
      </div>
    ),
  },
  {
    id: "account",
    title: "3. Rejestracja i konto",
    content: (
      <BulletList
        items={[
          "Minimalny wiek: 18 lat",
          "Jeden email = jedno konto",
          "Użytkownik odpowiada za bezpieczeństwo hasła",
          `Prawo do usunięcia konta na żądanie (${COMPANY_LEGAL.privacyEmail})`,
        ]}
      />
    ),
  },
  {
    id: "subscriptions",
    title: "4. Subskrypcje i płatności",
    content: (
      <BulletList
        items={[
          "Free: bezterminowy dostęp do podstawowych funkcji",
          "Pro ($9/mo lub $79/rok): pełny dostęp do modułów AI",
          "Pro+ ($19/mo lub $149/rok): API access + broker integration",
          "Płatności przez Stripe (karty, BLIK)",
          "Anulowanie: w dowolnym momencie, dostęp do końca okresu rozliczeniowego",
          "Zwroty: 14 dni od zakupu (prawo UE do odstąpienia od umowy)",
          "Early Adopter: pierwsze 500 kont Pro zachowuje cenę $9/mo na zawsze",
        ]}
      />
    ),
  },
  {
    id: "permitted-use",
    title: "5. Dozwolone użycie",
    content: (
      <>
        <p className="font-medium text-textPrimary">Platforma jest przeznaczona wyłącznie do:</p>
        <BulletList items={["własnych badań inwestycyjnych", "nauki i edukacji finansowej", "paper tradingu (wirtualnego)"]} />
        <p className="mt-3 font-medium text-textPrimary">Zabronione jest:</p>
        <BulletList
          items={[
            "wykorzystanie danych do systemów HFT lub arbitrażu",
            "odsprzedaż danych lub sygnałów",
            "scraping API",
          ]}
        />
      </>
    ),
  },
  {
    id: "liability",
    title: "6. Ograniczenie odpowiedzialności",
    content: (
      <>
        <p>Operator nie ponosi odpowiedzialności za:</p>
        <BulletList
          items={[
            "straty finansowe wynikające z decyzji podjętych na podstawie analiz AI",
            "niedostępność platformy (SLA: 99% uptime, wyłączając planowane przerwy)",
            "dokładność danych rynkowych dostarczanych przez zewnętrznych dostawców (Polygon, EODHD, Alpha Vantage, Finnhub)",
          ]}
        />
      </>
    ),
  },
  {
    id: "law",
    title: "7. Prawo właściwe",
    content: (
      <p>
        Regulamin podlega prawu polskiemu. Sąd właściwy: sąd właściwy dla siedziby Operatora (
        {COMPANY_LEGAL.city}).
      </p>
    ),
  },
  {
    id: "changes",
    title: "8. Zmiany regulaminu",
    content: <p>30 dni wyprzedzenia emailem dla istotnych zmian. Kontynuacja korzystania = akceptacja zmian.</p>,
  },
  {
    id: "contact",
    title: "9. Kontakt",
    content: (
      <address className="not-italic">
        <p>{COMPANY_LEGAL.name}</p>
        <p>{COMPANY_ADDRESS_LINE}</p>
        <p className="mt-2">
          Email:{" "}
          <a href={`mailto:${COMPANY_LEGAL.supportEmail}`} className="font-medium text-brandCyan hover:underline">
            {COMPANY_LEGAL.supportEmail}
          </a>
        </p>
      </address>
    ),
  },
];
