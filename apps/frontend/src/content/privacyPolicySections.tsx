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

export const privacyPolicySections: LegalSection[] = [
  {
    id: "who",
    title: "1. Kim jesteśmy",
    defaultOpen: true,
    content: (
      <p>
        StockAI Pro ({COMPANY_LEGAL.website}) to platforma badań inwestycyjnych i coachingu behawioralnego,
        prowadzona przez {COMPANY_LEGAL.name} z siedzibą w {COMPANY_LEGAL.city}, {COMPANY_LEGAL.country} (
        {COMPANY_ADDRESS_LINE}). Nie jesteśmy brokerem, doradcą inwestycyjnym ani instytucją finansową.
      </p>
    ),
  },
  {
    id: "collect",
    title: "2. Jakie dane zbieramy",
    content: (
      <>
        <BulletList
          items={[
            "Dane rejestracyjne: email, hasło (hash bcrypt), imię (opcjonalne)",
            "Dane użytkowania: sygnały, paper trades, preferencje językowe",
            "Dane techniczne: adres IP, user agent, cookies sesyjne",
            "Dane behawioralne: wzorce klikania (tylko zagregowane, nie indywidualne)",
          ]}
        />
        <p className="mt-3 font-medium text-textPrimary">Nie zbieramy:</p>
        <BulletList items={["danych finansowych konta bankowego", "numerów kart poza procesorem Stripe", "danych bankowych użytkownika"]} />
      </>
    ),
  },
  {
    id: "use",
    title: "3. Jak używamy danych",
    content: (
      <>
        <BulletList
          items={[
            "Świadczenie usług platformy",
            "Personalizacja analiz AI i coachingu",
            "Wysyłka emaili transakcyjnych (weryfikacja, digest)",
            "Poprawa produktu (zagregowane statystyki)",
          ]}
        />
        <p className="mt-3 font-medium text-textPrimary">Nie:</p>
        <BulletList items={["sprzedajemy danych osobom trzecim", "używamy danych do reklam targetowanych"]} />
      </>
    ),
  },
  {
    id: "legal-basis",
    title: "4. Podstawa prawna (RODO Art. 6)",
    content: (
      <BulletList
        items={[
          "Wykonanie umowy (Art. 6 ust. 1 lit. b) — świadczenie usług",
          "Uzasadniony interes (Art. 6 ust. 1 lit. f) — bezpieczeństwo, zapobieganie nadużyciom",
          "Zgoda (Art. 6 ust. 1 lit. a) — marketing email, cookies analityczne",
        ]}
      />
    ),
  },
  {
    id: "retention",
    title: "5. Przechowywanie danych",
    content: (
      <BulletList
        items={[
          "Dane konta: do usunięcia konta + 30 dni",
          "Logi techniczne: 90 dni",
          "Dane płatności (Stripe): zgodnie z polityką Stripe (do 7 lat dla celów podatkowych)",
        ]}
      />
    ),
  },
  {
    id: "rights",
    title: "6. Prawa użytkownika (RODO)",
    content: (
      <>
        <BulletList
          items={[
            "Prawo dostępu do danych (Art. 15)",
            "Prawo do sprostowania (Art. 16)",
            'Prawo do usunięcia ("prawo do bycia zapomnianym") (Art. 17)',
            "Prawo do przenoszenia danych (Art. 20)",
            "Prawo do sprzeciwu (Art. 21)",
          ]}
        />
        <p className="mt-3">
          Kontakt w sprawach RODO:{" "}
          <a href={`mailto:${COMPANY_LEGAL.privacyEmail}`} className="font-medium text-brandCyan hover:underline">
            {COMPANY_LEGAL.privacyEmail}
          </a>
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "7. Cookies",
    content: (
      <BulletList
        items={[
          "Niezbędne: sesja, preferencje językowe (zawsze aktywne)",
          "Analityczne: Google Analytics 4 (tylko za zgodą)",
          "Marketing: brak",
        ]}
      />
    ),
  },
  {
    id: "third-parties",
    title: "8. Usługi trzecich",
    content: (
      <ul className="space-y-2">
        <li>
          <strong>Stripe</strong> (płatności) —{" "}
          <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-brandCyan hover:underline">
            stripe.com/privacy
          </a>
        </li>
        <li>
          <strong>Resend</strong> (emaile) —{" "}
          <a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-brandCyan hover:underline">
            resend.com/privacy
          </a>
        </li>
        <li>
          <strong>Hetzner</strong> (hosting) —{" "}
          <a
            href="https://www.hetzner.com/legal/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brandCyan hover:underline"
          >
            hetzner.com/legal/privacy-policy
          </a>
        </li>
        <li>
          <strong>Anthropic Claude</strong> (AI) —{" "}
          <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer" className="text-brandCyan hover:underline">
            anthropic.com/privacy
          </a>
        </li>
        <li>
          <strong>Alpaca</strong> (trading API) —{" "}
          <a href="https://alpaca.markets/privacy" target="_blank" rel="noopener noreferrer" className="text-brandCyan hover:underline">
            alpaca.markets/privacy
          </a>
        </li>
      </ul>
    ),
  },
  {
    id: "changes",
    title: "9. Zmiany polityki",
    content: <p>Powiadomimy emailem o istotnych zmianach z 30-dniowym wyprzedzeniem.</p>,
  },
  {
    id: "dpo",
    title: "10. Kontakt DPO",
    content: (
      <p>
        W sprawach ochrony danych:{" "}
        <a href={`mailto:${COMPANY_LEGAL.privacyEmail}`} className="font-medium text-brandCyan hover:underline">
          {COMPANY_LEGAL.privacyEmail}
        </a>
      </p>
    ),
  },
];
