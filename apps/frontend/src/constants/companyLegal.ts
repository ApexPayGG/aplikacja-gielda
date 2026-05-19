/** Dane podmiotu operującego StockAI Pro — źródło: https://www.amcenergy.pl */
export const COMPANY_LEGAL = {
  name: "AMC Energy Sp. z o.o.",
  street: "ul. Targowa 7",
  postalCode: "06-650",
  city: "Konopki",
  country: "Polska",
  regionalOffice: "ul. Gdyńska 103/6D, 80-209 Chwaszczyno, Polska",
  krs: "0000729822",
  nip: "5882438094",
  regon: "380075791",
  privacyEmail: "privacy@stock-ai.pro",
  supportEmail: "support@stock-ai.pro",
  website: "stock-ai.pro",
  privacyEffectiveDate: "1 czerwca 2026",
} as const;

export const COMPANY_ADDRESS_LINE = `${COMPANY_LEGAL.street}, ${COMPANY_LEGAL.postalCode} ${COMPANY_LEGAL.city}, ${COMPANY_LEGAL.country}`;
