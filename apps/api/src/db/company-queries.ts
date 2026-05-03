import type { Company } from "@prisma/client";
import type { CompanyProfile } from "../types/scraper.types";
import { prisma } from "./index";

export async function upsertCompany(symbol: string, profile: CompanyProfile): Promise<Company> {
  const sym = symbol.toUpperCase();
  return prisma.company.upsert({
    where: { symbol: sym },
    create: {
      symbol: sym,
      name: profile.name || sym,
      sector: profile.sector || "Unknown",
      industry: profile.industry || "Unknown",
      logoUrl: profile.logoUrl ?? null,
      description: profile.description ?? null,
      webUrl: profile.webUrl ?? null,
    },
    update: {
      name: profile.name || sym,
      sector: profile.sector || "Unknown",
      industry: profile.industry || "Unknown",
      logoUrl: profile.logoUrl ?? null,
      description: profile.description ?? null,
      webUrl: profile.webUrl ?? null,
    },
  });
}

export async function getCompanyBySymbol(symbol: string): Promise<Company | null> {
  return prisma.company.findUnique({
    where: { symbol: symbol.toUpperCase() },
  });
}

export async function getCompaniesBySector(
  sector: string,
  page = 1,
  pageSize = 20,
): Promise<{ items: Company[]; total: number; page: number; pageSize: number }> {
  const take = Math.min(100, Math.max(1, pageSize));
  const skip = (Math.max(1, page) - 1) * take;

  const where = {
    sector: { equals: sector, mode: "insensitive" as const },
  };

  const [total, items] = await prisma.$transaction([
    prisma.company.count({ where }),
    prisma.company.findMany({
      where,
      orderBy: { symbol: "asc" },
      skip,
      take,
    }),
  ]);

  return { items, total, page: Math.max(1, page), pageSize: take };
}

export async function searchCompanies(query: string, limit = 20): Promise<Company[]> {
  const q = query.trim();
  if (!q) return [];

  const take = Math.min(50, Math.max(1, limit));

  return prisma.company.findMany({
    where: {
      OR: [
        { symbol: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: { symbol: "asc" },
    take,
  });
}
