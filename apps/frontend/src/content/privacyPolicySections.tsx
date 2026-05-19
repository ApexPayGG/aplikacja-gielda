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
    title: "1. Administrator danych i charakter usługi",
    defaultOpen: true,
    content: (
      <div className="space-y-3">
        <p>
          Administratorem danych osobowych w rozumieniu Rozporządzenia Parlamentu Europejskiego i Rady (UE) 2016/679
          (RODO) jest <strong>{COMPANY_LEGAL.name}</strong>, {COMPANY_ADDRESS_LINE}, NIP: {COMPANY_LEGAL.nip}, KRS:{" "}
          {COMPANY_LEGAL.krs}.
        </p>
        <p>
          StockAI Pro ({COMPANY_LEGAL.website}) to platforma SaaS do badań inwestycyjnych, analizy behawioralnej i
          symulacji paper tradingu. Nie jesteśmy brokerem, doradcą inwestycyjnym, instytucją płatniczą ani podmiotem
          nadzorowanym przez KNF w zakresie doradztwa inwestycyjnego.
        </p>
      </div>
    ),
  },
  {
    id: "collect",
    title: "2. Zakres i kategorie przetwarzanych danych",
    content: (
      <>
        <p>Przetwarzamy wyłącznie dane adekwatne do świadczenia usługi:</p>
        <BulletList
          items={[
            "Dane identyfikacyjne i kontaktowe: adres e-mail, imię (opcjonalnie), identyfikator konta",
            "Dane uwierzytelniania: hasło przechowywane wyłącznie w formie jednokierunkowego skrótu (bcrypt)",
            "Dane użytkowania produktu: konfiguracja watchlist, sygnały, historia paper trades, wpisy dziennika emocji, preferencje językowe",
            "Dane techniczne: adres IP, nagłówek User-Agent, identyfikatory sesji, znaczniki czasu żądań API",
            "Dane behawioralne produktu: zdarzenia w aplikacji w formie zagregowanej analityki (po wyrażeniu zgody na cookies analityczne)",
            "Dane rozliczeniowe: identyfikator klienta Stripe, status subskrypcji, okres rozliczeniowy (bez przechowywania pełnych numerów kart po stronie StockAI Pro)",
          ]}
        />
        <p className="mt-3 font-medium text-textPrimary">Nie zbieramy:</p>
        <BulletList
          items={[
            "numerów rachunków bankowych użytkownika",
            "pełnych danych kart płatniczych (obsługę prowadzi Stripe jako niezależny administrator/procesor)",
            "danych wrażliwych w rozumieniu art. 9 RODO, o ile użytkownik nie poda ich dobrowolnie w polach tekstowych",
          ]}
        />
      </>
    ),
  },
  {
    id: "infrastructure",
    title: "3. Infrastruktura techniczna i logowanie",
    content: (
      <>
        <p>Dane operacyjne przechowujemy i przetwarzamy w infrastrukturze hostowanej w UE (m.in. Hetzner), z zastosowaniem:</p>
        <BulletList
          items={[
            "TimescaleDB / PostgreSQL — trwałe dane konta, historii paper tradingu, sygnałów, konfiguracji użytkownika oraz logów aplikacyjnych niezbędnych do audytu i wsparcia",
            "Redis — krótkotrwałe dane sesji, cache odpowiedzi API, kolejki zadań oraz mechanizmy ograniczania liczby żądań (rate limiting)",
            "Szyfrowanie transmisji TLS oraz kontrola dostępu do środowisk produkcyjnych",
          ]}
        />
        <p className="mt-3">
          Logi techniczne (w tym adres IP i metadane żądań) przechowujemy maksymalnie 90 dni, o ile dłuższy okres nie
          wynika z obowiązku prawnego lub dochodzenia roszczeń.
        </p>
      </>
    ),
  },
  {
    id: "use",
    title: "4. Cele i sposób wykorzystania danych",
    content: (
      <>
        <BulletList
          items={[
            "Rejestracja, logowanie, weryfikacja e-mail i utrzymanie konta użytkownika",
            "Świadczenie funkcji analitycznych, coachingu behawioralnego i paper tradingu",
            "Personalizacja treści generowanych przez modele AI (m.in. Anthropic Claude) w oparciu o profil użytkowania",
            "Obsługa subskrypcji i płatności przez Stripe",
            "Komunikacja transakcyjna (reset hasła, potwierdzenia, digest)",
            "Bezpieczeństwo platformy, wykrywanie nadużyć i zapobieganie oszustwom",
            "Statystyki produktowe i poprawa jakości usługi (w formie zagregowanej)",
          ]}
        />
        <p className="mt-3 font-medium text-textPrimary">Nie sprzedajemy danych osobowych podmiotom trzecim.</p>
        <p>Nie prowadzimy profilowania wyłącznie automatycznego wywołującego skutki prawne wobec użytkownika.</p>
        <p>Nie wykorzystujemy danych do reklam targetowanych osób trzecich.</p>
      </>
    ),
  },
  {
    id: "legal-basis",
    title: "5. Podstawy prawne przetwarzania (RODO art. 6)",
    content: (
      <BulletList
        items={[
          "Art. 6 ust. 1 lit. b RODO — wykonanie umowy o świadczenie usług StockAI Pro",
          "Art. 6 ust. 1 lit. f RODO — prawnie uzasadniony interes administratora (bezpieczeństwo IT, logi, dochodzenie roszczeń, rozwój produktu)",
          "Art. 6 ust. 1 lit. a RODO — zgoda (marketing e-mail, cookies analityczne Google Analytics 4)",
          "Art. 6 ust. 1 lit. c RODO — obowiązki prawne, w szczególności w zakresie rozliczeń podatkowych powiązanych z płatnościami",
        ]}
      />
    ),
  },
  {
    id: "retention",
    title: "6. Okres przechowywania danych",
    content: (
      <BulletList
        items={[
          "Dane konta i treści użytkownika: do momentu usunięcia konta + 30 dni na backup i zamknięcie spraw administracyjnych",
          "Historia paper trades i wpisy coachingowe: przez czas trwania konta, następnie usunięcie zgodnie z żądaniem użytkownika",
          "Logi techniczne i bezpieczeństwa: do 90 dni",
          "Dane rozliczeniowe Stripe: zgodnie z polityką Stripe i wymogami prawa podatkowego (do 7 lat, jeśli wymagane)",
          "Zgody marketingowe: do czasu wycofania zgody",
        ]}
      />
    ),
  },
  {
    id: "rights",
    title: "7. Prawa osoby, której dane dotyczą",
    content: (
      <>
        <p>Przysługują Państwu następujące prawa:</p>
        <BulletList
          items={[
            "prawo dostępu do danych (art. 15 RODO)",
            "prawo do sprostowania (art. 16 RODO)",
            "prawo do usunięcia danych (art. 17 RODO)",
            "prawo do ograniczenia przetwarzania (art. 18 RODO)",
            "prawo do przenoszenia danych (art. 20 RODO)",
            "prawo sprzeciwu wobec przetwarzania (art. 21 RODO)",
            "prawo wycofania zgody w dowolnym momencie bez wpływu na zgodność z prawem przetwarzania przed wycofaniem",
            "prawo wniesienia skargi do Prezesa UODO (ul. Stawki 2, 00-193 Warszawa)",
          ]}
        />
        <p className="mt-3">
          Wnioski realizujemy pod adresem:{" "}
          <a href={`mailto:${COMPANY_LEGAL.privacyEmail}`} className="font-medium text-brandCyan hover:underline">
            {COMPANY_LEGAL.privacyEmail}
          </a>
          . Odpowiadamy bez zbędnej zwłoki, nie później niż w terminach wynikających z RODO.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "8. Pliki cookies i technologie śledzące",
    content: (
      <>
        <BulletList
          items={[
            "Cookies niezbędne — utrzymanie sesji JWT, preferencje językowe, bezpieczeństwo (zawsze aktywne)",
            "Cookies analityczne — Google Analytics 4 (aktywowane wyłącznie po wyrażeniu zgody w banerze cookies)",
            "Cookies marketingowe — nie stosujemy",
          ]}
        />
        <p className="mt-3">
          Identyfikator pomiaru GA4 konfigurowany jest przez zmienną środowiskową aplikacji i ładowany wyłącznie po
          zgodzie użytkownika na cookies analityczne. Szczegóły:{" "}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brandCyan hover:underline"
          >
            polityka Google
          </a>
          .
        </p>
      </>
    ),
  },
  {
    id: "third-parties",
    title: "9. Odbiorcy danych i podmioty przetwarzające",
    content: (
      <>
        <p>Dane mogą być powierzane zaufanym podmiotom przetwarzającym na podstawie umów powierzenia (DPA), w tym:</p>
        <ul className="mt-2 space-y-2">
          <li>
            <strong>Stripe</strong> — płatności i subskrypcje (
            <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-brandCyan hover:underline">
              stripe.com/privacy
            </a>
            )
          </li>
          <li>
            <strong>Resend</strong> — wysyłka e-maili transakcyjnych (
            <a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-brandCyan hover:underline">
              resend.com/legal/privacy-policy
            </a>
            )
          </li>
          <li>
            <strong>Hetzner</strong> — hosting infrastruktury (
            <a
              href="https://www.hetzner.com/legal/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brandCyan hover:underline"
            >
              hetzner.com/legal/privacy-policy
            </a>
            )
          </li>
          <li>
            <strong>Anthropic</strong> — przetwarzanie zapytań AI (
            <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer" className="text-brandCyan hover:underline">
              anthropic.com/privacy
            </a>
            )
          </li>
          <li>
            <strong>Alpaca Markets</strong> — integracja paper/live trading API (
            <a href="https://alpaca.markets/privacy" target="_blank" rel="noopener noreferrer" className="text-brandCyan hover:underline">
              alpaca.markets/privacy
            </a>
            )
          </li>
          <li>
            <strong>Google</strong> — Analytics 4 (po zgodzie) (
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-brandCyan hover:underline">
              policies.google.com/privacy
            </a>
            )
          </li>
        </ul>
        <p className="mt-3">
          Przekazanie danych poza EOG następuje wyłącznie przy użyciu mechanizmów zgodnych z RODO (np. Standardowe
          Klauzule Umowne), jeśli dany podmiot przetwarza dane poza Unią Europejską.
        </p>
      </>
    ),
  },
  {
    id: "security",
    title: "10. Bezpieczeństwo danych",
    content: (
      <p>
        Stosujemy środki organizacyjne i techniczne adekwatne do ryzyka, w tym kontrolę dostępu, szyfrowanie transmisji,
        separację środowisk, kopie zapasowe oraz procedury reagowania na incydenty. W przypadku naruszenia ochrony danych
        osobowych, które może powodować wysokie ryzyko dla praw osób, poinformujemy użytkowników zgodnie z art. 34 RODO.
      </p>
    ),
  },
  {
    id: "changes",
    title: "11. Zmiany polityki prywatności",
    content: (
      <p>
        Zastrzegamy prawo do aktualizacji niniejszej polityki. O istotnych zmianach poinformujemy z co najmniej 30-dniowym
        wyprzedzeniem na adres e-mail powiązany z kontem oraz poprzez komunikat w aplikacji.
      </p>
    ),
  },
  {
    id: "dpo",
    title: "12. Kontakt w sprawach prywatności",
    content: (
      <p>
        Inspektor ochrony danych / kontakt RODO:{" "}
        <a href={`mailto:${COMPANY_LEGAL.privacyEmail}`} className="font-medium text-brandCyan hover:underline">
          {COMPANY_LEGAL.privacyEmail}
        </a>
        . Korespondencja tradycyjna: {COMPANY_LEGAL.name}, {COMPANY_ADDRESS_LINE}.
      </p>
    ),
  },
];
