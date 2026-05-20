import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { colors } from "../styles/designSystem";

type HttpMethod = "GET" | "POST" | "DELETE";

type EndpointParam = {
  name: string;
  type: string;
  required: "yes" | "no";
  description: string;
};

type EndpointDoc = {
  method: HttpMethod;
  path: string;
  description: string;
  params: EndpointParam[];
  responseExample: string;
};

type EndpointSection = {
  id: string;
  title: string;
  description: string;
  endpoint: EndpointDoc;
};

const endpointSections: EndpointSection[] = [
  {
    id: "quotes",
    title: "Quotes",
    description: "Pobieraj najnowsze notowania i podstawowe dane cenowe.",
    endpoint: {
      method: "GET",
      path: "/api/quotes/latest?ticker={symbol}",
      description: "Zwraca najnowszy dostępny quote dla wskazanego symbolu.",
      params: [
        { name: "ticker", type: "string", required: "yes", description: "Ticker instrumentu, np. AAPL." },
      ],
      responseExample: `{
  "ticker": "AAPL",
  "price": 197.44,
  "currency": "USD",
  "timestamp": "2026-05-17T20:34:12.000Z"
}`,
    },
  },
  {
    id: "signals",
    title: "Signals",
    description: "Przeglądaj sygnały inwestycyjne generowane przez StockAI Pro.",
    endpoint: {
      method: "GET",
      path: "/api/signals?limit=20",
      description: "Pobiera listę ostatnich sygnałów, domyślnie z limitem.",
      params: [
        { name: "limit", type: "number", required: "no", description: "Liczba rekordów do pobrania (max 100)." },
      ],
      responseExample: `{
  "items": [
    { "ticker": "NVDA", "signal": "BUY", "score": 89, "createdAt": "2026-05-17T19:02:41.000Z" },
    { "ticker": "MSFT", "signal": "HOLD", "score": 73, "createdAt": "2026-05-17T18:11:09.000Z" }
  ]
}`,
    },
  },
  {
    id: "companies",
    title: "Companies",
    description: "Wyszukuj spółki po nazwie, tickerze lub słowie kluczowym.",
    endpoint: {
      method: "GET",
      path: "/api/companies/search?q={query}",
      description: "Zwraca listę spółek dopasowanych do zapytania.",
      params: [{ name: "q", type: "string", required: "yes", description: "Fraza wyszukiwania." }],
      responseExample: `{
  "items": [
    { "ticker": "TSLA", "name": "Tesla, Inc.", "exchange": "NASDAQ" },
    { "ticker": "TLSA", "name": "Tiziana Life Sciences", "exchange": "NASDAQ" }
  ]
}`,
    },
  },
  {
    id: "dividend",
    title: "Dividend",
    description: "Analizuj spółki dywidendowe i filtrowanie screenera.",
    endpoint: {
      method: "GET",
      path: "/api/dividend/screener",
      description: "Pobiera wyniki domyślnego screenera dywidendowego.",
      params: [
        { name: "sector", type: "string", required: "no", description: "Opcjonalny filtr sektora." },
        { name: "minYield", type: "number", required: "no", description: "Minimalna stopa dywidendy." },
      ],
      responseExample: `{
  "items": [
    { "ticker": "KO", "yield": 3.12, "payoutRatio": 0.71 },
    { "ticker": "PG", "yield": 2.51, "payoutRatio": 0.63 }
  ]
}`,
    },
  },
  {
    id: "portfolio",
    title: "Portfolio",
    description: "Pobieraj portfel paper trading dla konkretnego użytkownika.",
    endpoint: {
      method: "GET",
      path: "/api/paper/portfolio/:userId",
      description: "Zwraca aktualny stan portfela paper trading.",
      params: [{ name: "userId", type: "string", required: "yes", description: "Id użytkownika w ścieżce URL." }],
      responseExample: `{
  "userId": "usr_1234",
  "cash": 14500.21,
  "equity": 25240.66,
  "positions": [
    { "ticker": "AAPL", "quantity": 10, "avgPrice": 176.2 },
    { "ticker": "AMD", "quantity": 25, "avgPrice": 141.5 }
  ]
}`,
    },
  },
];

const sidebarItems = [
  { id: "authentication", label: "Authentication" },
  { id: "quotes", label: "Quotes" },
  { id: "signals", label: "Signals" },
  { id: "companies", label: "Companies" },
  { id: "dividend", label: "Dividend" },
  { id: "portfolio", label: "Portfolio" },
];

function methodBadgeStyle(method: HttpMethod): CSSProperties {
  if (method === "POST") {
    return { backgroundColor: `${colors.positive}1A`, color: colors.positive, borderColor: `${colors.positive}66` };
  }
  if (method === "DELETE") {
    return { backgroundColor: `${colors.negative}1A`, color: colors.negative, borderColor: `${colors.negative}66` };
  }
  return { backgroundColor: `${colors.brandCyan}1A`, color: colors.brandDark, borderColor: `${colors.brandCyan}66` };
}

export function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-bgSecondary px-4 py-10 text-white sm:px-6">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="hidden h-fit glass-section rounded-2xl p-4 shadow-sm lg:sticky lg:top-24 lg:block">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/50">Sections</p>
          <nav className="space-y-1">
            {sidebarItems.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="block rounded-lg px-3 py-2 text-sm font-medium glass-muted transition hover:bg-bgSecondary hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </aside>

        <main className="space-y-6">
          <header className="glass-section rounded-2xl p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-3xl font-bold text-white">API Documentation</h1>
                <p className="mt-2 glass-muted text-sm">Dostęp do danych StockAI Pro przez REST API</p>
              </div>
              <span
                className="inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white"
                style={{ backgroundColor: colors.brandDark, borderColor: colors.brandDark }}
              >
                Pro+ only
              </span>
            </div>
            <p className="mt-4 rounded-lg border border-brandGold/50 bg-brandGold/10 px-3 py-2 text-sm text-white">
              Pro+ required for real access. Endpointy są pokazane publicznie wyłącznie w celach dokumentacyjnych.
            </p>
          </header>

          <section id="authentication" className="glass-section rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-white">Authentication</h2>
            <p className="mt-2 glass-muted text-sm">Użyj API key z ustawień konta</p>
            <pre className="mt-4 overflow-x-auto rounded-xl glass-panel border border-white/10 bg-white/5 p-4 text-sm text-white">
              <code>{`curl -H "Authorization: Bearer {api_key}" https://stock-ai.pro/api/...`}</code>
            </pre>
            <div className="mt-4 glass-muted text-sm">
              Klucz API znajdziesz w <Link to="/settings" className="font-semibold text-white hover:text-brandMedium">Settings</Link>.
            </div>
          </section>

          {endpointSections.map((section) => (
            <section key={section.id} id={section.id} className="glass-section rounded-2xl p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-white">{section.title}</h2>
              <p className="mt-2 glass-muted text-sm">{section.description}</p>

              <div className="mt-4 rounded-xl glass-panel border border-white/10 bg-white/5 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-md border px-2 py-1 text-xs font-semibold" style={methodBadgeStyle(section.endpoint.method)}>
                    {section.endpoint.method}
                  </span>
                  <code className="font-mono text-sm font-semibold" style={{ color: colors.brandDark }}>
                    {section.endpoint.path}
                  </code>
                </div>

                <p className="mt-3 glass-muted text-sm">{section.endpoint.description}</p>

                <div className="mt-4 overflow-x-auto rounded-lg glass-panel border border-white/10">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-bgSecondary glass-muted">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Parametr</th>
                        <th className="px-3 py-2 font-semibold">Typ</th>
                        <th className="px-3 py-2 font-semibold">Wymagany</th>
                        <th className="px-3 py-2 font-semibold">Opis</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.endpoint.params.map((param) => (
                        <tr key={param.name} className="border-t border-white/10">
                          <td className="px-3 py-2 font-mono text-xs text-white">{param.name}</td>
                          <td className="px-3 py-2 glass-muted">{param.type}</td>
                          <td className="px-3 py-2 glass-muted">{param.required}</td>
                          <td className="px-3 py-2 glass-muted">{param.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <pre className="mt-4 overflow-x-auto rounded-lg glass-panel border border-white/10 p-4 text-sm text-white">
                  <code>{section.endpoint.responseExample}</code>
                </pre>
              </div>
            </section>
          ))}
        </main>
      </div>
    </div>
  );
}
