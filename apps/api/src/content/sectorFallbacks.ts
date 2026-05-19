type BriefSection = { lang: string; body: string };

export type AnalysisResult = {
  brief: string;
  updatedAt: string;
  requestedLang: string;
  sections: BriefSection[];
};

export type SectorKey =
  | "communication"
  | "technology"
  | "financials"
  | "healthcare"
  | "energy"
  | "consumer"
  | "industrial"
  | "general";

function primaryLanguageBase(lang: string): string {
  const trimmed = lang.trim();
  if (!trimmed) return "en";
  return trimmed.split(/[-_]/)[0]!.toLowerCase();
}

function isEnglishLocale(lang: string): boolean {
  return primaryLanguageBase(lang) === "en";
}

export function classifySector(sector?: string | null, industry?: string | null): SectorKey {
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

type BriefCopy = { pl: string; en: string };

const BRIEF_TEMPLATES: Record<SectorKey, BriefCopy> = {
  communication: {
    pl: `{name} ({symbol}) wykazuje stabilne przepływy operacyjne w sektorze telekomunikacyjno-medialnym. Model biznesowy oparty na abonamentach, reklamie cyfrowej i dystrybucji treści zapewnia przewidywalność przychodów, choć presja regulacyjna i koszty praw do treści sportowych pozostają czynnikami do monitorowania.

W perspektywie technicznej notowania utrzymują się w przedziale konsolidacji wokół ostatniej sesji zamknięcia{priceHint}. Wolumen transakcyjny wskazuje na umiarkowaną aktywność inwestorów detalicznych i instytucjonalnych na GPW. Wskaźnik RSI{rsiHint} sugeruje brak skrajnych warunków wykupienia lub wyprzedania.

Sektor Communication Services w Polsce charakteryzuje się wysoką konkurencją w segmencie mobilnym oraz rosnącą penetracją usług OTT. {name} korzysta z synergii między telekomunikacją a mediami, co wspiera retencję klientów i cross-selling pakietów łączonych.

To nie jest spersonalizowana rekomendacja inwestycyjna. Przed podjęciem decyzji należy uwzględnić własną tolerancję ryzyka, horyzont inwestycyjny oraz aktualne dane fundamentalne i makroekonomiczne.`,
    en: `{name} ({symbol}) shows stable operating cash flows in the telecom and media sector. A business model built on subscriptions, digital advertising, and content distribution supports revenue visibility, while regulatory pressure and sports-rights costs remain factors to watch.

From a technical perspective, the stock is consolidating around the latest session close{priceHint}. Trading volume reflects moderate participation from retail and institutional investors. RSI{rsiHint} does not indicate extreme overbought or oversold conditions.

The Communication Services sector in Poland faces intense mobile competition and rising OTT adoption. {name} benefits from telecom–media synergies that support customer retention and bundled-product cross-selling.

This is not personalized investment advice. Consider your risk tolerance, time horizon, and current fundamental and macro data before making decisions.`,
  },
  technology: {
    pl: `{name} ({symbol}) działa w dynamicznym segmencie technologicznym, gdzie tempo innowacji i cykle produktowe wpływają na wyceny rynkowe. Przychody z core business pozostają kluczowym wskaźnikiem, a marże operacyjne zależą od skali i efektywności kosztowej.

Notowania w ostatniej sesji{priceHint} odzwierciedlają bieżące oczekiwania rynku wobec wzrostu i rentowności. RSI{rsiHint} warto interpretować łącznie z trendem wolumenu oraz poziomem wsparcia/oporu w szerszym oknie 20–60 sesji.

Sektor technologiczny jest wrażliwy na stopy procentowe, popyt korporacyjny i regulacje dotyczące AI oraz prywatności danych. {name} powinna być oceniana w kontekście konkurencji globalnej i lokalnej.

To nie jest spersonalizowana rekomendacja inwestycyjna.`,
    en: `{name} ({symbol}) operates in a fast-moving technology segment where innovation pace and product cycles drive market valuations. Core revenue growth and operating leverage remain key metrics for investors.

Latest session pricing{priceHint} reflects current market expectations for growth and profitability. RSI{rsiHint} should be read alongside volume trends and support/resistance over a 20–60 session window.

The technology sector is sensitive to rates, enterprise demand, and AI/privacy regulation. Evaluate {name} against global and local competitive dynamics.

This is not personalized investment advice.`,
  },
  financials: {
    pl: `{name} ({symbol}) funkcjonuje w sektorze finansowym, gdzie kluczowe są jakość aktywów, płynność oraz otoczenie stóp procentowych. Struktura portfela kredytowego i polityka dywidendowa determinują profil ryzyka dla akcjonariuszy.

Cena zamknięcia{priceHint} mieści się w bieżącym przedziale wyceny względem book value i wskaźników rentowności kapitału. RSI{rsiHint} może wspierać ocenę krótkoterminowego momentum bez wyprzedzania danych fundamentalnych.

Sektor bankowy i ubezpieczeniowy reaguje na cykl monetarny NBP/ECB oraz regulacje kapitałowe. {name} wymaga monitorowania jakości kredytu i marży odsetkowej netto.

To nie jest spersonalizowana rekomendacja inwestycyjna.`,
    en: `{name} ({symbol}) operates in financials, where asset quality, liquidity, and the rate environment are central. Loan-book composition and dividend policy define shareholder risk.

The latest close{priceHint} sits within the current valuation band versus book value and return-on-equity metrics. RSI{rsiHint} can inform short-term momentum without replacing fundamental analysis.

Banks and insurers respond to NBP/ECB policy and capital rules. Monitor credit quality and net interest margin for {name}.

This is not personalized investment advice.`,
  },
  healthcare: {
    pl: `{name} ({symbol}) reprezentuje sektor healthcare, w którym pipeline produktowy, regulacje FDA/EMA oraz umowy refundacyjne wpływają na perspektywy wzrostu. Stabilność przepływów z produktów dojrzałych często równoważy ryzyko R&D.

Notowania{priceHint} odzwierciedlają aktualną wycenę w kontekście marż, patentów i ekspozycji geograficznej. RSI{rsiHint} pomaga ocenić krótkoterminowe wahania sentymentu.

Sektor zdrowia jest defensywny, lecz podlega presji cenowej i polityce publicznej. {name} należy analizować wraz z kalendarzem wyników i komunikatami regulacyjnymi.

To nie jest spersonalizowana rekomendacja inwestycyjna.`,
    en: `{name} ({symbol}) represents healthcare, where product pipelines, FDA/EMA approvals, and reimbursement shape growth. Mature-product cash flows often balance R&D risk.

Pricing{priceHint} reflects current valuation versus margins, patents, and geographic mix. RSI{rsiHint} helps gauge short-term sentiment swings.

Healthcare is defensive but exposed to pricing pressure and policy. Review {name} alongside earnings cadence and regulatory updates.

This is not personalized investment advice.`,
  },
  energy: {
    pl: `{name} ({symbol}) działa w sektorze energetycznym, wrażliwym na ceny surowców, politykę klimatyczną i inwestycje w transformację. Przepływy operacyjne zależą od spreadów rafineryjnych, produkcji i regulacji taryfowych.

Ostatnia sesja{priceHint} pokazuje bieżącą równowagę popytu i podaży na akcjach spółki. RSI{rsiHint} może sygnalizować krótkoterminowe wyczerpanie trendu, ale decyzje powinny opierać się na horyzoncie cyklu.

Sektor energy wymaga uwagi na capex ESG, zadłużenie i ekspozycję na gaz/ropy. {name} oceniamy w kontekście dywidendy i polityki inwestycyjnej.

To nie jest spersonalizowana rekomendacja inwestycyjna.`,
    en: `{name} ({symbol}) operates in energy, sensitive to commodity prices, climate policy, and transition capex. Cash flows depend on refining spreads, production, and tariff regulation.

The latest session{priceHint} reflects current supply/demand balance in the stock. RSI{rsiHint} may flag short-term trend exhaustion; cycle horizon matters more.

Watch ESG capex, leverage, and oil/gas exposure for {name} alongside dividend and investment policy.

This is not personalized investment advice.`,
  },
  consumer: {
    pl: `{name} ({symbol}) należy do sektora konsumenckiego, gdzie kluczowe są siła marki, marże detaliczne i elastyczność popytu. Inflacja, siła nabywcza gospodarstw domowych oraz koszty łańcucha dostaw wpływają na wyniki kwartalne.

Cena{priceHint} mieści się w bieżącym przedziale wyceny względem wzrostu przychodów i rentowności segmentów. RSI{rsiHint} wspiera krótkoterminową ocenę techniczną.

Sektor consumer cyclical/defensive wymaga rozróżnienia profilu produktowego. {name} analizujemy łącznie z trendami e-commerce i udziałem rynkowym.

To nie jest spersonalizowana rekomendacja inwestycyjna.`,
    en: `{name} ({symbol}) sits in consumer sectors where brand strength, retail margins, and demand elasticity matter. Inflation, household purchasing power, and supply-chain costs drive quarterly results.

Price{priceHint} reflects current valuation versus revenue growth and segment profitability. RSI{rsiHint} supports short-term technical reads.

Distinguish cyclical vs defensive consumer exposure for {name}, including e-commerce and market-share trends.

This is not personalized investment advice.`,
  },
  industrial: {
    pl: `{name} ({symbol}) reprezentuje sektor industrial, powiązany z cyklem inwestycyjnym, zamówieniami B2B i kosztami surowców. Backlog zamówień i efektywność operacyjna decydują o widoczności wyników.

Notowania{priceHint} odzwierciedlają oczekiwania co do marży i wolumenu produkcji. RSI{rsiHint} może wskazywać krótkoterminowe korekty w trendzie.

Sektor przemysłowy reaguje na PMI, logistykę globalną i politykę handlową. {name} warto oceniać razem z capex i strukturą kontraktów długoterminowych.

To nie jest spersonalizowana rekomendacja inwestycyjna.`,
    en: `{name} ({symbol}) represents industrials tied to the investment cycle, B2B orders, and input costs. Order backlog and operational efficiency drive earnings visibility.

Pricing{priceHint} embeds expectations for margins and production volumes. RSI{rsiHint} may highlight short-term trend corrections.

Industrials respond to PMI, global logistics, and trade policy. Review {name} with capex plans and long-term contract mix.

This is not personalized investment advice.`,
  },
  general: {
    pl: `{name} ({symbol}) prezentuje profil inwestycyjny typowy dla spółek notowanych na lokalnym rynku kapitałowym. Analiza fundamentalna powinna obejmować wzrost przychodów, rentowność, zadłużenie oraz politykę wypłaty dywidendy.

W ostatniej sesji kurs{priceHint} odzwierciedla bieżącą równowagę popytu i podaży. Wskaźnik RSI{rsiHint} może wspierać ocenę krótkoterminowego momentum, jednak nie zastępuje analizy wieloletniej.

Sektor {sector} i branża {industry} determinują główne czynniki ryzyka i szanse wzrostu. Inwestorzy powinni śledzić komunikaty spółki, raporty okresowe oraz otoczenie makroekonomiczne.

To nie jest spersonalizowana rekomendacja inwestycyjna. Decyzje inwestycyjne wymagają własnej analizy i akceptacji ryzyka.`,
    en: `{name} ({symbol}) offers a profile typical of locally listed equities. Fundamental work should cover revenue growth, profitability, leverage, and dividend policy.

The latest session close{priceHint} reflects current supply/demand balance. RSI{rsiHint} can inform short-term momentum but does not replace multi-year analysis.

The {sector} sector and {industry} industry define key risks and growth drivers. Monitor company disclosures, periodic reports, and macro conditions.

This is not personalized investment advice. Investment decisions require your own analysis and risk acceptance.`,
  },
};

function fillBriefTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? "");
}

export function buildFallbackBrief(params: {
  symbol: string;
  companyName?: string | null;
  sector?: string | null;
  industry?: string | null;
  localeTag: string;
  closePrice?: string | null;
  rsi?: string | null;
}): AnalysisResult {
  const sym = params.symbol.toUpperCase();
  const lang = (params.localeTag ?? "en").trim() || "en";
  const sectorKey = classifySector(params.sector, params.industry);
  const name = params.companyName?.trim() || sym;
  const sectorLabel = params.sector?.trim() || "ogólny";
  const industryLabel = params.industry?.trim() || "branża";

  const priceHint = params.closePrice ? ` (${params.closePrice} PLN/USD)` : "";
  const rsiHint = params.rsi ? ` (${params.rsi})` : " — brak danych";

  const template = BRIEF_TEMPLATES[sectorKey];
  const vars = {
    name,
    symbol: sym,
    priceHint,
    rsiHint: params.rsi ? ` (${params.rsi})` : " — brak danych",
    sector: sectorLabel,
    industry: industryLabel,
  };

  const plBody = fillBriefTemplate(template.pl, vars);
  const enBody = fillBriefTemplate(template.en, {
    ...vars,
    rsiHint: params.rsi ? ` (${params.rsi})` : " — unavailable",
  });

  const sections: BriefSection[] = isEnglishLocale(lang)
    ? [{ lang: "en", body: enBody }]
    : [
        { lang, body: plBody },
        { lang: "en", body: enBody },
      ];

  const updatedAt = new Date().toISOString();
  return {
    brief: sections.map((s) => s.body).join("\n\n---\n\n"),
    updatedAt,
    requestedLang: lang,
    sections,
  };
}

export type FallbackNewsItem = {
  id: string;
  symbol: string;
  timestamp: string;
  title: string;
  url: string;
  source: string;
  sentiment: null;
};

const NEWS_TEMPLATES: Record<SectorKey, Array<{ pl: string; en: string }>> = {
  communication: [
    {
      pl: "Operatorzy telekomunikacyjni raportują stabilny wzrost ARPU w segmencie usług łączonych",
      en: "Telecom operators report steady ARPU growth in convergent service bundles",
    },
    {
      pl: "Rynek reklamy wideo w Polsce rośnie dwucyfrowo; nadawcy linear i OTT konkurują o inventory",
      en: "Polish video ad market grows double digits as linear and OTT compete for inventory",
    },
    {
      pl: "Prawa do transmisji sportowych pozostają kluczowym czynnikiem kosztowym dla grup medialnych",
      en: "Sports broadcast rights remain a key cost driver for media groups",
    },
  ],
  technology: [
    {
      pl: "Spółki software'owe notują wzrost zamówień enterprise w segmencie chmury hybrydowej",
      en: "Software names see rising enterprise orders in hybrid cloud",
    },
    {
      pl: "Regulacje AI w UE wpływają na harmonogramy wdrożeń produktów technologicznych",
      en: "EU AI rules affect rollout timelines for technology products",
    },
    {
      pl: "Sektor tech GPW: inwestorzy oceniają marże po sezonie wyników kwartalnych",
      en: "GPW tech: investors reassess margins after quarterly earnings season",
    },
  ],
  financials: [
    {
      pl: "Banki centralne sygnalizują ostrożniejsze tempo obniżek stóp procentowych",
      en: "Central banks signal a more cautious pace of rate cuts",
    },
    {
      pl: "Sektor bankowy: marża odsetkowa netto pod presją konkurencji depozytowej",
      en: "Banking sector: net interest margin under deposit competition pressure",
    },
    {
      pl: "Kredyt hipoteczny: popyt stabilizuje się po wcześniejszej korekcie",
      en: "Mortgage demand stabilizes after earlier correction",
    },
  ],
  healthcare: [
    {
      pl: "Producenci pharma monitorują listy refundacyjne i harmonogramy wprowadzeń leków",
      en: "Pharma producers watch reimbursement lists and drug launch schedules",
    },
    {
      pl: "Sektor med-tech raportuje rosnące zamówienia na sprzęt diagnostyczny",
      en: "Med-tech sector reports rising diagnostic equipment orders",
    },
    {
      pl: "Inwestorzy oceniają pipeline R&D w kontekście presji cenowej w UE",
      en: "Investors weigh R&D pipelines amid EU pricing pressure",
    },
  ],
  energy: [
    {
      pl: "Ceny gazu ziemnego stabilizują się po wcześniejszej zmienności sezonowej",
      en: "Natural gas prices stabilize after seasonal volatility",
    },
    {
      pl: "Spółki energetyczne aktualizują plany inwestycji w OZE i magazyny energii",
      en: "Energy firms update renewables and storage investment plans",
    },
    {
      pl: "Rynek węgla notuje umiarkowany popyt przemysłowy w regionie CEE",
      en: "Coal market sees moderate industrial demand in CEE",
    },
  ],
  consumer: [
    {
      pl: "Detaliści raportują poprawę sprzedaży same-store w segmencie non-food",
      en: "Retailers report improving same-store sales in non-food",
    },
    {
      pl: "Konsumenci reagują na promocje; marże detaliczne pozostają pod obserwacją",
      en: "Consumers respond to promotions; retail margins remain in focus",
    },
    {
      pl: "Sektor FMCG: producenci przenoszą część kosztów surowców na ceny końcowe",
      en: "FMCG: producers pass part of input cost inflation to shelf prices",
    },
  ],
  industrial: [
    {
      pl: "PMI przemysłowy w strefie euro wskazuje ostrożne odbicie zamówień B2B",
      en: "Eurozone manufacturing PMI hints at cautious B2B order recovery",
    },
    {
      pl: "Producentów industrial dotykają koszty logistyki i terminów dostaw komponentów",
      en: "Industrial producers face logistics costs and component lead times",
    },
    {
      pl: "Backlog zamówień w sektorze capital goods pozostaje na podwyższonym poziomie",
      en: "Capital goods order backlog stays elevated",
    },
  ],
  general: [
    {
      pl: "GPW: indeks WIG20 konsoliduje się po wcześniejszej zmienności makro",
      en: "WSE: WIG20 consolidates after recent macro-driven volatility",
    },
    {
      pl: "Inwestorzy instytucjonalni zwiększają alokację w spółkach o stabilnej dywidendzie",
      en: "Institutional investors increase allocation to stable dividend names",
    },
    {
      pl: "Sektor {sector}: analitycy aktualizują modele po publikacji danych makro",
      en: "{sector} sector: analysts refresh models after macro data releases",
    },
  ],
};

export function buildFallbackNews(params: {
  symbol: string;
  companyName?: string | null;
  sector?: string | null;
  industry?: string | null;
  limit?: number;
  preferPolish?: boolean;
}): FallbackNewsItem[] {
  const sym = params.symbol.toUpperCase();
  const sectorKey = classifySector(params.sector, params.industry);
  const name = params.companyName?.trim() || sym;
  const limit = Math.min(3, Math.max(1, params.limit ?? 3));
  const templates = NEWS_TEMPLATES[sectorKey].slice(0, limit);
  const now = Date.now();

  return templates.map((item, index) => {
    const titleTemplate = params.preferPolish !== false ? item.pl : item.en;
    const title = titleTemplate
      .replace("{name}", name)
      .replace("{symbol}", sym)
      .replace("{sector}", params.sector?.trim() || "general");
    const hoursAgo = (index + 1) * 6;
    return {
      id: `fallback-${sym}-${index + 1}`,
      symbol: sym,
      timestamp: new Date(now - hoursAgo * 60 * 60 * 1000).toISOString(),
      title,
      url: "#",
      source: "StockAI Feed",
      sentiment: null,
    };
  });
}
