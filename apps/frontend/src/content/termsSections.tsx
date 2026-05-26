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
          '"Regulamin" — niniejszy dokument określający zasady korzystania z Platformy',
          '"Platforma" — serwis stock-ai.pro oraz aplikacja webowa StockAI Pro',
          '"Użytkownik" — osoba fizyczna posiadająca konto, która korzysta z Platformy',
          '"Usługi" — funkcje analityczne, sygnały, coaching behawioralny, paper trading oraz integracje API',
          `"Operator" — ${COMPANY_LEGAL.name}, ${COMPANY_ADDRESS_LINE}`,
          '"Paper trading" — symulacja transakcji bez użycia rzeczywistego kapitału na Platformie',
        ]}
      />
    ),
  },
  {
    id: "nature",
    title: "2. Charakter usług i zastrzeżenie inwestycyjne",
    content: (
      <div className="space-y-3 rounded-xl border border-amber-400/30 bg-amber-500/5 p-4 text-textPrimary">
        <p>
          StockAI Pro świadczy wyłącznie usługi edukacyjne, informacyjne i analityczne w modelu SaaS. Platforma{" "}
          <strong>nie jest</strong> doradcą inwestycyjnym w rozumieniu ustawy o obrocie instrumentami finansowymi,
          brokerem, domem maklerskim ani usługą zarządzania portfelem.
        </p>
        <p>
          Wszelkie analizy, sygnały, oceny ryzyka oraz treści generowane przez sztuczną inteligencję (w tym Claude AI)
          mają charakter wyłącznie informacyjny. Nie stanowią rekomendacji inwestycyjnej, oferty nabycia lub zbycia
          instrumentów finansowych ani porady prawnej/podatkowej.
        </p>
        <p className="font-medium">
          Użytkownik samodzielnie i na własną odpowiedzialność podejmuje decyzje inwestycyjne. Operator nie gwarantuje
          zysków ani dokładności prognoz.
        </p>
      </div>
    ),
  },
  {
    id: "account",
    title: "3. Rejestracja, wiek i konto",
    content: (
      <BulletList
        items={[
          "Korzystanie z Platformy wymaga ukończenia 18 lat i pełnej zdolności do czynności prawnych",
          "Jeden adres e-mail może być przypisany do jednego konta",
          "Użytkownik zobowiązany jest do podania prawdziwych danych i ochrony hasła",
          "Udostępnianie konta osobom trzecim jest zabronione",
          `Usunięcie konta: wniosek na ${COMPANY_LEGAL.privacyEmail} — realizacja w rozsądnym terminie technicznym`,
        ]}
      />
    ),
  },
  {
    id: "subscriptions",
    title: "4. Subskrypcje, okres próbny, ceny i płatności Stripe",
    content: (
      <>
        <p>
          StockAI Pro działa w modelu subskrypcyjnym SaaS z dostępem trial-first. Platforma{" "}
          <strong>nie oferuje</strong> klasycznego, bezterminowego planu Free z pełnym dostępem do produktu.
          Po rejestracji Użytkownik może rozpocząć okres próbny; po jego zakończeniu konto pozostaje aktywne, lecz
          dostęp do kluczowych funkcji może zostać ograniczony (Trial Expired Mode), do czasu wykupienia planu
          płatnego.
        </p>
        <p className="mt-3 font-medium text-textPrimary">Okres próbny (trial):</p>
        <BulletList
          items={[
            "7 dni — okres próbny bez podania karty płatniczej, z ograniczonym dostępem do funkcji Pro+ i limitami AI",
            "14 dni — okres próbny z kartą płatniczą (gdy dostępny w Stripe), z dostępem Pro+ w modelu fair-use; po zakończeniu trialu subskrypcja może automatycznie przejść na wybrany plan płatny",
            "Zakres trialu, limity oraz funkcje wyłączone w trialu określa aktualny cennik na stronie /pricing",
          ]}
        />
        <p className="mt-3 font-medium text-textPrimary">Plany płatne (EUR, rozliczenie cykliczne przez Stripe):</p>
        <BulletList
          items={[
            "Pro — 29 EUR/miesiąc lub 290 EUR/rok: moduły AI, sygnały, analizy premium w zakresie planu Pro",
            "Pro+ — 59 EUR/miesiąc lub 590 EUR/rok: pełniejszy zakres analiz, coaching behawioralny, integracje w zakresie planu Pro+",
            "Investor OS — 99 EUR/miesiąc lub 990 EUR/rok: plan rozszerzony (Personal Fit, analiza portfelowa i inne funkcje), gdy udostępniony w produkcie",
            "Aktualne ceny, zakres funkcji oraz dostępność checkoutu zawsze podane są na stronie /pricing",
            "Checkout Stripe w EUR może być włączany etapami po migracji cen; do czasu pełnej aktywacji dostęp beta może wymagać ręcznej aktywacji konta",
          ]}
        />
        <p className="mt-3 font-medium text-textPrimary">Płatności, anulowanie i prawa konsumenta:</p>
        <BulletList
          items={[
            "Płatności: karty płatnicze oraz metody obsługiwane przez Stripe w danym regionie (np. BLIK, gdy dostępny)",
            "Opłata za plan płatny pobierana jest z góry na początek okresu rozliczeniowego (miesięcznego lub rocznego)",
            "Anulowanie subskrypcji w ustawieniach konta lub panelu Stripe — dostęp do planu płatnego trwa do końca opłaconego okresu",
            "Po wygaśnięciu trialu bez wykupienia planu Użytkownik zachowuje dostęp do konta, ustawień, rozliczeń i ograniczonego podglądu zgodnie z Trial Expired Mode",
            "Prawo odstąpienia od umowy zawartej na odległość: 14 dni od pierwszej opłaty za plan płatny, o ile usługa nie została w pełni wykonana za wyraźną zgodą Użytkownika przed upływem terminu odstąpienia",
            "W okresie trialu bez pobrania opłaty odstąpienie dotyczy ewentualnej umowy o płatną subskrypcję zgodnie z informacją podaną przy aktywacji trialu z kartą",
          ]}
        />
        <p className="mt-3 text-sm">
          Operator może aktualizować cennik, modele trialu oraz zakres planów z zachowaniem praw konsumenta.
          Posiadacze aktywnej subskrypcji zostaną poinformowani o istotnych zmianach z wyprzedzeniem. W razie
          rozbieżności między Regulaminem a stroną /pricing wiążące są informacje na /pricing w zakresie cen i
          dostępności planów.
        </p>
      </>
    ),
  },
  {
    id: "paper-trading",
    title: "5. Paper trading (handel wirtualny)",
    content: (
      <>
        <p>Moduł paper tradingu służy wyłącznie celom edukacyjnym i symulacyjnym:</p>
        <BulletList
          items={[
            "Transakcje paper nie są składane na rzeczywistych rynkach regulowanych za pośrednictwem StockAI Pro",
            "Wyniki symulacji nie odzwierciedlają przyszłych wyników inwestycyjnych",
            "Dane rynkowe mogą pochodzić od zewnętrznych dostawców i zawierać opóźnienia lub błędy",
            "Integracja z brokerem (np. Alpaca) w planie Pro+ podlega osobnym warunkom dostawcy zewnętrznego",
            "Użytkownik nie powinien traktować paper tradingu jako testu gwarantującego skuteczność strategii na koncie rzeczywistym",
          ]}
        />
      </>
    ),
  },
  {
    id: "permitted-use",
    title: "6. Dozwolone i zabronione zachowania",
    content: (
      <>
        <p className="font-medium text-textPrimary">Dozwolone:</p>
        <BulletList items={["własne badania rynkowe", "edukacja finansowa", "paper trading i analiza behawioralna"]} />
        <p className="mt-3 font-medium text-textPrimary">Zabronione:</p>
        <BulletList
          items={[
            "automatyczny scraping, reverse engineering API lub obchodzenie limitów",
            "odsprzedaż sygnałów, danych lub dostępu do Platformy",
            "wykorzystanie Platformy do działań niezgodnych z prawem",
            "podszywanie się pod inne osoby lub podmioty",
          ]}
        />
      </>
    ),
  },
  {
    id: "liability",
    title: "7. Odpowiedzialność i dostępność",
    content: (
      <>
        <p>W najszerszym zakresie dopuszczalnym przez prawo polskie Operator nie ponosi odpowiedzialności za:</p>
        <BulletList
          items={[
            "straty finansowe wynikające z decyzji podjętych na podstawie treści Platformy lub AI",
            "przerwy w działaniu usługi (docelowy SLA: 99% uptime rocznie, z wyłączeniem prac planowanych)",
            "błędy danych rynkowych dostawców zewnętrznych (Polygon, EODHD, Alpha Vantage, Finnhub i inni)",
            "działanie podmiotów trzecich (Stripe, brokerzy, dostawcy AI)",
          ]}
        />
        <p className="mt-3">
          Odpowiedzialność Operatora wobec konsumenta pozostaje ograniczona wyłącznie w zakresie dozwolonym przez
          bezwzględnie obowiązujące przepisy prawa.
        </p>
      </>
    ),
  },
  {
    id: "law",
    title: "8. Prawo właściwe i spory",
    content: (
      <p>
        Regulamin podlega prawu polskiemu. Spory z konsumentami rozstrzygają sądy właściwe według przepisów o ochronie
        konsumentów. W pozostałym zakresie właściwy jest sąd siedziby Operatora ({COMPANY_LEGAL.city}).
      </p>
    ),
  },
  {
    id: "changes",
    title: "9. Zmiany regulaminu",
    content: (
      <p>
        Operator może zmienić Regulamin z ważnych przyczyn (zmiana prawa, funkcji, modelu biznesowego). O istotnych
        zmianach Użytkownik zostanie poinformowany e-mailem co najmniej 30 dni wcześniej. Dalsze korzystanie po wejściu
        zmian w życie oznacza akceptację, o ile Użytkownik nie rozwiąże umowy.
      </p>
    ),
  },
  {
    id: "contact",
    title: "10. Kontakt",
    content: (
      <address className="not-italic">
        <p>{COMPANY_LEGAL.name}</p>
        <p>{COMPANY_ADDRESS_LINE}</p>
        <p className="mt-2">
          Wsparcie:{" "}
          <a href={`mailto:${COMPANY_LEGAL.supportEmail}`} className="font-medium text-brandCyan hover:underline">
            {COMPANY_LEGAL.supportEmail}
          </a>
        </p>
      </address>
    ),
  },
];
