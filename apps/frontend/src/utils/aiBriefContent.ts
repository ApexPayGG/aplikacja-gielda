export type SectorSentiment = {
  score: number;
  label: "Niedźwiedzi" | "Neutralny" | "Byczy";
};

export type AIBriefInsight = {
  morningBullets: [string, string, string];
  sentiment: SectorSentiment;
  behavioralWarning: string;
};

function hashSymbol(symbol: string): number {
  let hash = 0;
  for (let i = 0; i < symbol.length; i += 1) {
    hash = (hash * 31 + symbol.charCodeAt(i)) >>> 0;
  }
  return hash;
}

const MORNING_TEMPLATES: [string, string, string][] = [
  [
    "Sesja otwiera się pod presją rotacji kapitału z growth do wartości; inwestorzy instytucjonalni redukują ekspozycję na krótki horyzont po silnym raporcie makro.",
    "Kalendarz wyników wskazuje na kluczowe odczyty marż operacyjnych — konsensus zakłada stabilizację, lecz guidance może zaskoczyć w górę przy utrzymaniu popytu B2B.",
    "Płynność w pierwszej godzinie handlu jest podwyższona; wolumen overnight sugeruje aktywną dywersyfikację portfeli przed decyzją Fed w tym tygodniu.",
  ],
  [
    "Notowania reagują na publikację danych PMI sektora usług powyżej prognoz, co wspiera narrację soft-landing i krótkoterminowy risk-on w defensywie cyklicznej.",
    "Spread obligacji korporacyjnych zwęża się, sygnalizując poprawę apetytu na ryzyko; dywidendy i buybacki pozostają głównym katalizatorem wyceny w segmencie large-cap.",
    "Analitycy podnoszą cele cenowe po lepszych od szacunków przychodach segmentowych; uwaga skupia się na utrzymaniu free cash flow w Q2.",
  ],
  [
    "Rynek dyskontuje scenariusz spowolnienia popytu konsumenckiego, jednak zamówienia z wyprzedzeniem w łańcuchu dostaw pozostają zgodne z planem produkcyjnym.",
    "Wahania surowców energetycznych hamują ekspansję marży brutto; zarząd sygnalizował hedging kosztów do końca roku obrotowego.",
    "Krótkie pozycje spekulacyjne maleją po publikacji pozytywnego komentarza zarządu na konferencji branżowej — sentyment poprawia się stopniowo.",
  ],
  [
    "Indeks sektorowy notuje korektę techniczną po testowaniu oporu; kapitał wraca do spółek z silnym bilansem i niskim zadłużeniem netto.",
    "Publikacja danych o zatrudnieniu w USA wzmacnia oczekiwania na dłuższą pauzę w cyklu podwyżek stóp, co sprzyja wycenom growth w średnim terminie.",
    "Transakcje insider buying w ostatnich dwóch tygodniach wspierają tezę o atrakcyjnej wycenie względem średniej historycznej EV/EBITDA.",
  ],
];

const BEHAVIORAL_WARNINGS: string[] = [
  "Sentyment detaliczny jest skrajnie euforyczny. Rekomendowana dyscyplina i unikanie FOMO przy obecnych wycenach.",
  "Wolumen spekulacyjny rośnie szybciej niż fundamenty. Rozważ limitowanie rozmiaru pozycji i zaplanowany poziom stop-loss przed wejściem.",
  "Medialny szum po wynikach kwartalnych zniekształca percepcję ryzyka. Odczekaj na potwierdzenie trendu wolumenem instytucjonalnym.",
  "Korelacja z indeksem szerokim rynku jest wysoka — dywersyfikacja w obrębie sektora nie redukuje ryzyka systemowego w krótkim horyzoncie.",
  "Historyczna zmienność po publikacji guidance bywa podwójna od średniej. Unikaj decyzji impulsywnych w pierwszej godzinie notowań.",
];

function sentimentFromHash(hash: number, sector: string): SectorSentiment {
  let score = 18 + (hash % 65);
  if (sector.toLowerCase().includes("tech")) {
    score = Math.min(100, score + 4);
  }
  if (score < 38) {
    return { score, label: "Niedźwiedzi" };
  }
  if (score > 62) {
    return { score, label: "Byczy" };
  }
  return { score, label: "Neutralny" };
}

export function buildAIBriefInsight(symbol: string, sector: string): AIBriefInsight {
  const hash = hashSymbol(symbol.trim().toUpperCase());
  const templateIndex = hash % MORNING_TEMPLATES.length;
  const morningBullets = MORNING_TEMPLATES[templateIndex] ?? MORNING_TEMPLATES[0];
  const warningIndex = (hash >> 4) % BEHAVIORAL_WARNINGS.length;

  return {
    morningBullets,
    sentiment: sentimentFromHash(hash, sector),
    behavioralWarning: BEHAVIORAL_WARNINGS[warningIndex] ?? BEHAVIORAL_WARNINGS[0],
  };
}
