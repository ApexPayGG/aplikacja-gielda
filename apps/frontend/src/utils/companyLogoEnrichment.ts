import type { Company } from "../services/api";
import { resolveCompanyLogos } from "../services/api";

export type WithLogoUrl = {
  symbol?: string;
  ticker?: string;
  logoUrl?: string | null;
  logo?: string | null;
  name?: string;
  companyName?: string;
};

function readTicker(item: WithLogoUrl): string {
  return String(item.ticker ?? item.symbol ?? "")
    .trim()
    .toUpperCase();
}

function hasLogo(item: WithLogoUrl): boolean {
  const raw = item.logoUrl ?? item.logo;
  return typeof raw === "string" && raw.trim().length > 0;
}

export async function enrichItemsWithCompanyLogos<T extends WithLogoUrl>(items: T[]): Promise<T[]> {
  const missingTickers = [
    ...new Set(items.filter((item) => !hasLogo(item)).map((item) => readTicker(item)).filter(Boolean)),
  ];
  if (missingTickers.length === 0) return items;

  const lookup = await resolveCompanyLogos(missingTickers);

  return items.map((item) => {
    const ticker = readTicker(item);
    const meta = lookup[ticker];
    if (!meta) return item;
    const existingLogo = item.logoUrl ?? item.logo;
    const logoUrl =
      typeof existingLogo === "string" && existingLogo.trim() ? existingLogo.trim() : meta.logoUrl;
    const companyName = item.companyName ?? item.name;
    return {
      ...item,
      logoUrl,
      ...(companyName || !meta.name ? {} : { name: meta.name, companyName: meta.name }),
    };
  });
}

export async function enrichCompaniesWithLogos(companies: Company[]): Promise<Company[]> {
  return enrichItemsWithCompanyLogos(companies);
}
