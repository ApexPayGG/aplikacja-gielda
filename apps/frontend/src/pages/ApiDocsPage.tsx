import type { CSSProperties } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
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
  titleKey: string;
  titleDefault: string;
  descriptionTranslationKey:
    | "apiDocsPage.quotes.sectionDesc"
    | "apiDocsPage.signals.sectionDesc"
    | "apiDocsPage.companies.sectionDesc"
    | "apiDocsPage.dividend.sectionDesc"
    | "apiDocsPage.portfolio.sectionDesc";
  endpoint: EndpointDoc & {
    descriptionTranslationKey:
      | "apiDocsPage.quotes.endpointDesc"
      | "apiDocsPage.signals.endpointDesc"
      | "apiDocsPage.companies.endpointDesc"
      | "apiDocsPage.dividend.endpointDesc"
      | "apiDocsPage.portfolio.endpointDesc";
    paramTranslationKeys?: Record<string, string>;
  };
};

type EndpointSectionTemplate = Omit<EndpointSection, "endpoint"> & {
  endpoint: Omit<
    EndpointSection["endpoint"],
    "description" | "params"
  > & {
    params: Array<
      Omit<EndpointParam, "description"> & {
        translationKey: string;
      }
    >;
  };
};

const endpointSectionsTemplate: EndpointSectionTemplate[] = [
  {
    id: "quotes",
    titleKey: "apiDocsPage.navQuotes",
    titleDefault: "Quotes",
    descriptionTranslationKey: "apiDocsPage.quotes.sectionDesc",
    endpoint: {
      method: "GET",
      path: "/api/quotes/latest?ticker={symbol}",
      descriptionTranslationKey: "apiDocsPage.quotes.endpointDesc",
      params: [
        {
          name: "ticker",
          type: "string",
          required: "yes",
          translationKey: "apiDocsPage.quotes.tickerParam",
        },
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
    titleKey: "apiDocsPage.navSignals",
    titleDefault: "Signals",
    descriptionTranslationKey: "apiDocsPage.signals.sectionDesc",
    endpoint: {
      method: "GET",
      path: "/api/signals?limit=20",
      descriptionTranslationKey: "apiDocsPage.signals.endpointDesc",
      params: [
        {
          name: "limit",
          type: "number",
          required: "no",
          translationKey: "apiDocsPage.signals.limitParam",
        },
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
    titleKey: "apiDocsPage.navCompanies",
    titleDefault: "Companies",
    descriptionTranslationKey: "apiDocsPage.companies.sectionDesc",
    endpoint: {
      method: "GET",
      path: "/api/companies/search?q={query}",
      descriptionTranslationKey: "apiDocsPage.companies.endpointDesc",
      params: [
        {
          name: "q",
          type: "string",
          required: "yes",
          translationKey: "apiDocsPage.companies.qParam",
        },
      ],
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
    titleKey: "apiDocsPage.navDividend",
    titleDefault: "Dividend",
    descriptionTranslationKey: "apiDocsPage.dividend.sectionDesc",
    endpoint: {
      method: "GET",
      path: "/api/dividend/screener",
      descriptionTranslationKey: "apiDocsPage.dividend.endpointDesc",
      params: [
        {
          name: "sector",
          type: "string",
          required: "no",
          translationKey: "apiDocsPage.dividend.sectorParam",
        },
        {
          name: "minYield",
          type: "number",
          required: "no",
          translationKey: "apiDocsPage.dividend.minYieldParam",
        },
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
    titleKey: "apiDocsPage.navPortfolio",
    titleDefault: "Portfolio",
    descriptionTranslationKey: "apiDocsPage.portfolio.sectionDesc",
    endpoint: {
      method: "GET",
      path: "/api/paper/portfolio/:userId",
      descriptionTranslationKey: "apiDocsPage.portfolio.endpointDesc",
      params: [
        {
          name: "userId",
          type: "string",
          required: "yes",
          translationKey: "apiDocsPage.portfolio.userIdParam",
        },
      ],
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
  const { t } = useTranslation();

  const sidebarItems = useMemo(
    () => [
      {
        id: "authentication",
        label: t("apiDocsPage.authentication.title", { defaultValue: "Authentication" }),
      },
      ...endpointSectionsTemplate.map((section) => ({
        id: section.id,
        label: t(section.titleKey, { defaultValue: section.titleDefault }),
      })),
    ],
    [t],
  );

  const endpointSections = useMemo(
    () =>
      endpointSectionsTemplate.map((section) => ({
        ...section,
        title: t(section.titleKey, { defaultValue: section.titleDefault }),
        description: t(section.descriptionTranslationKey),
        endpoint: {
          ...section.endpoint,
          description: t(section.endpoint.descriptionTranslationKey),
          params: section.endpoint.params.map((param) => ({
            name: param.name,
            type: param.type,
            required: param.required,
            description: t(param.translationKey),
          })),
        },
      })),
    [t],
  );

  return (
    <div className="min-h-screen bg-bgSecondary px-4 py-10 text-white sm:px-6">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="hidden h-fit glass-section rounded-2xl p-4 shadow-sm lg:sticky lg:top-24 lg:block">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/50">
            {t("apiDocsPage.sectionsLabel", { defaultValue: "Sections" })}
          </p>
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
                <p className="mt-2 glass-muted text-sm">{t("apiDocsPage.heroSubtitle")}</p>
              </div>
              <span
                className="inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white"
                style={{ backgroundColor: colors.brandDark, borderColor: colors.brandDark }}
              >
                {t("apiDocsPage.proPlusBadge", { defaultValue: "Pro+ only" })}
              </span>
            </div>
            <p className="mt-4 rounded-lg border border-brandGold/50 bg-brandGold/10 px-3 py-2 text-sm text-white">{t("apiDocsPage.proPlusNote")}</p>
          </header>

          <section id="authentication" className="glass-section rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-white">{t("apiDocsPage.authentication.title", { defaultValue: "Authentication" })}</h2>
            <p className="mt-2 glass-muted text-sm">{t("apiDocsPage.authHint")}</p>
            <pre className="mt-4 overflow-x-auto rounded-xl glass-panel border border-white/10 bg-white/5 p-4 text-sm text-white">
              <code>{`curl -H "Authorization: Bearer {api_key}" https://stock-ai.pro/api/...`}</code>
            </pre>
            <div className="mt-4 glass-muted text-sm">
              {t("apiDocsPage.authKeyLead")}{" "}
              <Link to="/settings" className="font-semibold text-white hover:text-brandMedium">
                {t("apiDocsPage.settingsLinkLabel")}
              </Link>
              .
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
                        <th className="px-3 py-2 font-semibold">{t("apiDocsPage.paramTableName")}</th>
                        <th className="px-3 py-2 font-semibold">{t("apiDocsPage.paramTableType")}</th>
                        <th className="px-3 py-2 font-semibold">{t("apiDocsPage.paramTableRequired")}</th>
                        <th className="px-3 py-2 font-semibold">{t("apiDocsPage.paramTableDesc")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.endpoint.params.map((param) => (
                        <tr key={param.name} className="border-t border-white/10">
                          <td className="px-3 py-2 font-mono text-xs text-white">{param.name}</td>
                          <td className="px-3 py-2 glass-muted">{param.type}</td>
                          <td className="px-3 py-2 glass-muted">
                            {param.required === "yes"
                              ? t("apiDocsPage.requiredYes", { defaultValue: "yes" })
                              : t("apiDocsPage.requiredNo", { defaultValue: "no" })}
                          </td>
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
