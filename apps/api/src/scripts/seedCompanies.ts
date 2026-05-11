import { prisma } from "../db/index";

type SeedCompany = {
  symbol: string;
  name: string;
  market: "GPW" | "US" | "DAX";
  sector: string;
  industry: string;
  country: string;
  currency: string;
};

const gpwCompanies: SeedCompany[] = [
  { symbol: "PKN", name: "PKN Orlen SA", market: "GPW", sector: "Energy", industry: "Integrated Oil & Gas", country: "PL", currency: "PLN" },
  { symbol: "PZU", name: "PZU SA", market: "GPW", sector: "Financials", industry: "Insurance", country: "PL", currency: "PLN" },
  { symbol: "PKO", name: "PKO Bank Polski SA", market: "GPW", sector: "Financials", industry: "Banking", country: "PL", currency: "PLN" },
  { symbol: "KGHM", name: "KGHM Polska Miedz SA", market: "GPW", sector: "Materials", industry: "Metals & Mining", country: "PL", currency: "PLN" },
  { symbol: "LPP", name: "LPP SA", market: "GPW", sector: "Consumer Discretionary", industry: "Apparel Retail", country: "PL", currency: "PLN" },
  { symbol: "DNP", name: "Dino Polska SA", market: "GPW", sector: "Consumer Staples", industry: "Food Retail", country: "PL", currency: "PLN" },
  { symbol: "ALE", name: "Allegro.eu SA", market: "GPW", sector: "Consumer Discretionary", industry: "E-commerce", country: "PL", currency: "PLN" },
  { symbol: "PEO", name: "Bank Pekao SA", market: "GPW", sector: "Financials", industry: "Banking", country: "PL", currency: "PLN" },
  { symbol: "MBK", name: "mBank SA", market: "GPW", sector: "Financials", industry: "Banking", country: "PL", currency: "PLN" },
  { symbol: "SPL", name: "Santander Bank Polska SA", market: "GPW", sector: "Financials", industry: "Banking", country: "PL", currency: "PLN" },
  { symbol: "CDR", name: "CD Projekt SA", market: "GPW", sector: "Communication Services", industry: "Interactive Entertainment", country: "PL", currency: "PLN" },
  { symbol: "JSW", name: "Jastrzebska Spolka Weglowa SA", market: "GPW", sector: "Materials", industry: "Coal & Consumable Fuels", country: "PL", currency: "PLN" },
  { symbol: "CCC", name: "CCC SA", market: "GPW", sector: "Consumer Discretionary", industry: "Footwear Retail", country: "PL", currency: "PLN" },
  { symbol: "KGH", name: "KGHM Legacy Series", market: "GPW", sector: "Materials", industry: "Metals & Mining", country: "PL", currency: "PLN" },
  { symbol: "OPL", name: "Orange Polska SA", market: "GPW", sector: "Communication Services", industry: "Telecom Services", country: "PL", currency: "PLN" },
  { symbol: "BDX", name: "Budimex SA", market: "GPW", sector: "Industrials", industry: "Construction & Engineering", country: "PL", currency: "PLN" },
  { symbol: "EUR", name: "Eurocash SA", market: "GPW", sector: "Consumer Staples", industry: "Food Distribution", country: "PL", currency: "PLN" },
  { symbol: "GTC", name: "Globe Trade Centre SA", market: "GPW", sector: "Real Estate", industry: "Real Estate Management", country: "PL", currency: "PLN" },
  { symbol: "ING", name: "ING Bank Slaski SA", market: "GPW", sector: "Financials", industry: "Banking", country: "PL", currency: "PLN" },
  { symbol: "KER", name: "Kernel Holding SA", market: "GPW", sector: "Consumer Staples", industry: "Agricultural Products", country: "PL", currency: "PLN" },
  { symbol: "MRC", name: "Mercator Medical SA", market: "GPW", sector: "Health Care", industry: "Medical Supplies", country: "PL", currency: "PLN" },
  { symbol: "MRB", name: "Mirbud SA", market: "GPW", sector: "Industrials", industry: "Construction & Engineering", country: "PL", currency: "PLN" },
  { symbol: "PCO", name: "Pepco Group NV", market: "GPW", sector: "Consumer Discretionary", industry: "General Merchandise Retail", country: "PL", currency: "PLN" },
  { symbol: "PGE", name: "PGE Polska Grupa Energetyczna SA", market: "GPW", sector: "Utilities", industry: "Electric Utilities", country: "PL", currency: "PLN" },
  { symbol: "PKP", name: "PKP Cargo SA", market: "GPW", sector: "Industrials", industry: "Rail Transportation", country: "PL", currency: "PLN" },
  { symbol: "PLY", name: "Playway SA", market: "GPW", sector: "Communication Services", industry: "Interactive Entertainment", country: "PL", currency: "PLN" },
  { symbol: "SNK", name: "Sanok Rubber Company SA", market: "GPW", sector: "Industrials", industry: "Industrial Components", country: "PL", currency: "PLN" },
  { symbol: "TEN", name: "Ten Square Games SA", market: "GPW", sector: "Communication Services", industry: "Interactive Entertainment", country: "PL", currency: "PLN" },
  { symbol: "TPE", name: "TAURON Polska Energia SA", market: "GPW", sector: "Utilities", industry: "Electric Utilities", country: "PL", currency: "PLN" },
  { symbol: "WIG", name: "WIG Index Proxy", market: "GPW", sector: "Index", industry: "Broad Market Index", country: "PL", currency: "PLN" },
];

const usCompanies: SeedCompany[] = [
  { symbol: "AAPL", name: "Apple Inc.", market: "US", sector: "Information Technology", industry: "Consumer Electronics", country: "US", currency: "USD" },
  { symbol: "MSFT", name: "Microsoft Corporation", market: "US", sector: "Information Technology", industry: "Systems Software", country: "US", currency: "USD" },
  { symbol: "NVDA", name: "NVIDIA Corporation", market: "US", sector: "Information Technology", industry: "Semiconductors", country: "US", currency: "USD" },
  { symbol: "GOOGL", name: "Alphabet Inc. Class A", market: "US", sector: "Communication Services", industry: "Interactive Media & Services", country: "US", currency: "USD" },
  { symbol: "AMZN", name: "Amazon.com Inc.", market: "US", sector: "Consumer Discretionary", industry: "Broadline Retail", country: "US", currency: "USD" },
  { symbol: "META", name: "Meta Platforms Inc.", market: "US", sector: "Communication Services", industry: "Interactive Media & Services", country: "US", currency: "USD" },
  { symbol: "TSLA", name: "Tesla Inc.", market: "US", sector: "Consumer Discretionary", industry: "Automobile Manufacturers", country: "US", currency: "USD" },
  { symbol: "BRK", name: "Berkshire Hathaway Inc.", market: "US", sector: "Financials", industry: "Multi-Sector Holdings", country: "US", currency: "USD" },
  { symbol: "JPM", name: "JPMorgan Chase & Co.", market: "US", sector: "Financials", industry: "Diversified Banks", country: "US", currency: "USD" },
  { symbol: "V", name: "Visa Inc.", market: "US", sector: "Financials", industry: "Transaction & Payment Processing", country: "US", currency: "USD" },
  { symbol: "UNH", name: "UnitedHealth Group Incorporated", market: "US", sector: "Health Care", industry: "Managed Health Care", country: "US", currency: "USD" },
  { symbol: "XOM", name: "Exxon Mobil Corporation", market: "US", sector: "Energy", industry: "Integrated Oil & Gas", country: "US", currency: "USD" },
  { symbol: "JNJ", name: "Johnson & Johnson", market: "US", sector: "Health Care", industry: "Pharmaceuticals", country: "US", currency: "USD" },
  { symbol: "WMT", name: "Walmart Inc.", market: "US", sector: "Consumer Staples", industry: "Consumer Staples Merchandise Retail", country: "US", currency: "USD" },
  { symbol: "MA", name: "Mastercard Incorporated", market: "US", sector: "Financials", industry: "Transaction & Payment Processing", country: "US", currency: "USD" },
  { symbol: "PG", name: "The Procter & Gamble Company", market: "US", sector: "Consumer Staples", industry: "Household Products", country: "US", currency: "USD" },
  { symbol: "HD", name: "The Home Depot Inc.", market: "US", sector: "Consumer Discretionary", industry: "Home Improvement Retail", country: "US", currency: "USD" },
  { symbol: "CVX", name: "Chevron Corporation", market: "US", sector: "Energy", industry: "Integrated Oil & Gas", country: "US", currency: "USD" },
  { symbol: "LLY", name: "Eli Lilly and Company", market: "US", sector: "Health Care", industry: "Pharmaceuticals", country: "US", currency: "USD" },
  { symbol: "ABBV", name: "AbbVie Inc.", market: "US", sector: "Health Care", industry: "Biotechnology", country: "US", currency: "USD" },
];

const daxCompanies: SeedCompany[] = [
  { symbol: "SAP", name: "SAP SE", market: "DAX", sector: "Information Technology", industry: "Application Software", country: "DE", currency: "EUR" },
  { symbol: "SIE", name: "Siemens AG", market: "DAX", sector: "Industrials", industry: "Industrial Conglomerates", country: "DE", currency: "EUR" },
  { symbol: "ALV", name: "Allianz SE", market: "DAX", sector: "Financials", industry: "Insurance", country: "DE", currency: "EUR" },
  { symbol: "DTE", name: "Deutsche Telekom AG", market: "DAX", sector: "Communication Services", industry: "Telecom Services", country: "DE", currency: "EUR" },
  { symbol: "BMW", name: "Bayerische Motoren Werke AG", market: "DAX", sector: "Consumer Discretionary", industry: "Automobile Manufacturers", country: "DE", currency: "EUR" },
  { symbol: "MRK", name: "Merck KGaA", market: "DAX", sector: "Health Care", industry: "Life Sciences Tools & Services", country: "DE", currency: "EUR" },
  { symbol: "BAS", name: "BASF SE", market: "DAX", sector: "Materials", industry: "Specialty Chemicals", country: "DE", currency: "EUR" },
  { symbol: "VOW", name: "Volkswagen AG", market: "DAX", sector: "Consumer Discretionary", industry: "Automobile Manufacturers", country: "DE", currency: "EUR" },
  { symbol: "ADS", name: "adidas AG", market: "DAX", sector: "Consumer Discretionary", industry: "Apparel, Accessories & Luxury Goods", country: "DE", currency: "EUR" },
  { symbol: "RWE", name: "RWE AG", market: "DAX", sector: "Utilities", industry: "Electric Utilities", country: "DE", currency: "EUR" },
];

async function main(): Promise<void> {
  const companies = [...gpwCompanies, ...usCompanies, ...daxCompanies];
  let created = 0;
  let updated = 0;

  for (const company of companies) {
    const existing = await prisma.company.findUnique({ where: { symbol: company.symbol } });
    await prisma.company.upsert({
      where: { symbol: company.symbol },
      create: {
        symbol: company.symbol,
        name: company.name,
        sector: company.sector,
        industry: company.industry,
        description: `Market=${company.market}; Country=${company.country}; Currency=${company.currency}`,
      },
      update: {
        name: company.name,
        sector: company.sector,
        industry: company.industry,
        description: `Market=${company.market}; Country=${company.country}; Currency=${company.currency}`,
      },
    });
    await prisma.$executeRawUnsafe(
      'UPDATE "companies" SET "exchange" = $1 WHERE "symbol" = $2',
      company.market,
      company.symbol,
    );
    if (existing) {
      updated += 1;
    } else {
      created += 1;
    }
  }

  console.log(
    `[seed:companies] total=${companies.length} added=${created} updated=${updated}`,
  );
}

main()
  .catch((error) => {
    console.error("[seed:companies] failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
