import type { NewsRow } from "../services/api";

type SectorKey =
  | "communication"
  | "technology"
  | "financials"
  | "healthcare"
  | "energy"
  | "consumer"
  | "industrial"
  | "general";

function classifySector(sector?: string | null, industry?: string | null): SectorKey {
  const haystack = `${sector ?? ""} ${industry ?? ""}`.toLowerCase();
  if (/telecom|communication|media|entertainment|broadcast|wireless|cyfrowy|polsat|streaming/.test(haystack)) {
    return "communication";
  }
  if (/tech|software|semiconductor|internet|cloud|ai\b/.test(haystack)) return "technology";
  if (/bank|financial|insurance|capital market/.test(haystack)) return "financials";
  if (/health|pharma|biotech|medical/.test(haystack)) return "healthcare";
  if (/energy|oil|gas|utility|mining/.test(haystack)) return "energy";
  if (/retail|consumer|food|beverage/.test(haystack)) return "consumer";
  if (/industrial|manufacturing|aerospace|defense|transport/.test(haystack)) return "industrial";
  return "general";
}

const TITLES: Record<SectorKey, string[]> = {
  communication: [
    "Operatorzy telekomunikacyjni raportują stabilny wzrost ARPU w segmencie usług łączonych",
    "Rynek reklamy wideo w Polsce rośnie dwucyfrowo; nadawcy linear i OTT konkurują o inventory",
    "Prawa do transmisji sportowych pozostają kluczowym czynnikiem kosztowym dla grup medialnych",
  ],
  technology: [
    "Spółki software'owe notują wzrost zamówień enterprise w segmencie chmury hybrydowej",
    "Regulacje AI w UE wpływają na harmonogramy wdrożeń produktów technologicznych",
    "Sektor tech GPW: inwestorzy oceniają marże po sezonie wyników kwartalnych",
  ],
  financials: [
    "Banki centralne sygnalizują ostrożniejsze tempo obniżek stóp procentowych",
    "Sektor bankowy: marża odsetkowa netto pod presją konkurencji depozytowej",
    "Kredyt hipoteczny: popyt stabilizuje się po wcześniejszej korekcie",
  ],
  healthcare: [
    "Producenci pharma monitorują listy refundacyjne i harmonogramy wprowadzeń leków",
    "Sektor med-tech raportuje rosnące zamówienia na sprzęt diagnostyczny",
    "Inwestorzy oceniają pipeline R&D w kontekście presji cenowej w UE",
  ],
  energy: [
    "Ceny gazu ziemnego stabilizują się po wcześniejszej zmienności sezonowej",
    "Spółki energetyczne aktualizują plany inwestycji w OZE i magazyny energii",
    "Rynek węgla notuje umiarkowany popyt przemysłowy w regionie CEE",
  ],
  consumer: [
    "Detaliści raportują poprawę sprzedaży same-store w segmencie non-food",
    "Konsumenci reagują na promocje; marże detaliczne pozostają pod obserwacją",
    "Sektor FMCG: producenci przenoszą część kosztów surowców na ceny końcowe",
  ],
  industrial: [
    "PMI przemysłowy w strefie euro wskazuje ostrożne odbicie zamówień B2B",
    "Producentów industrial dotykają koszty logistyki i terminów dostaw komponentów",
    "Backlog zamówień w sektorze capital goods pozostaje na podwyższonym poziomie",
  ],
  general: [
    "GPW: indeks WIG20 konsoliduje się po wcześniejszej zmienności makro",
    "Inwestorzy instytucjonalni zwiększają alokację w spółkach o stabilnej dywidendzie",
    "Analitycy aktualizują modele wyceny po publikacji danych makroekonomicznych",
  ],
};

export function buildSignalsFallbackNews(params: {
  symbol: string;
  sector?: string | null;
  industry?: string | null;
}): NewsRow[] {
  const sym = params.symbol.toUpperCase();
  const sectorKey = classifySector(params.sector, params.industry);
  const titles = TITLES[sectorKey];
  const now = Date.now();

  return titles.map((title, index) => ({
    id: `fallback-${sym}-${index + 1}`,
    symbol: sym,
    timestamp: new Date(now - (index + 1) * 6 * 60 * 60 * 1000).toISOString(),
    title,
    url: "#",
    source: "StockAI Feed",
    sentiment: null,
  }));
}
