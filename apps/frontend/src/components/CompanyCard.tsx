import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Company } from "../services/api";
import { getLogoFallbackUrl, getOptimizedLogoUrl, normalizeTickerSymbol } from "../utils/imageOptimization";
import { WatchlistButton } from "./WatchlistButton";

type Props = {
  company: Company;
};

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function CompanyCard({ company }: Props) {
  const [logoFailed, setLogoFailed] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [logoFallbackUsed, setLogoFallbackUsed] = useState(false);
  const companyMeta = company as Company & {
    price?: number | string | null;
    close?: number | string | null;
    lastPrice?: number | string | null;
    changePct?: number | string | null;
    changePercent?: number | string | null;
  };
  const latestPrice = readNumber(companyMeta.price ?? companyMeta.close ?? companyMeta.lastPrice);
  const changePct = readNumber(companyMeta.changePct ?? companyMeta.changePercent);
  const logoSrc = useMemo(() => {
    if (typeof company.logoUrl === "string" && company.logoUrl.trim()) return company.logoUrl.trim();
    const symbol = normalizeTickerSymbol(String(company.symbol ?? ""));
    if (!symbol) return undefined;
    return getOptimizedLogoUrl(symbol);
  }, [company.logoUrl, company.symbol]);

  const resolvedLogoSrc = logoFallbackUsed ? getLogoFallbackUrl(company.symbol) : logoSrc;

  useEffect(() => {
    setLogoFailed(false);
    setLogoLoaded(false);
    setLogoFallbackUsed(false);
  }, [logoSrc]);

  const fallbackInitials = useMemo(() => {
    const source = (company.name || company.symbol).trim();
    if (!source) return "NA";
    const words = source.split(/\s+/).filter(Boolean);
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return `${words[0].charAt(0)}${words[1].charAt(0)}`.toUpperCase();
  }, [company.name, company.symbol]);

  const showLogo = Boolean(resolvedLogoSrc) && !logoFailed;

  return (
    <Link
      to={`/company/${encodeURIComponent(company.symbol)}/premium`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-bgPrimary shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="absolute right-3 top-3 z-10">
        <WatchlistButton symbol={company.symbol} />
      </div>
      <div className="relative flex h-28 items-center justify-center bg-bgSecondary p-4">
        {showLogo ? (
          <>
            {!logoLoaded ? (
              <div className="absolute inset-0 flex items-center justify-center bg-bgSecondary">
                <div className="h-16 w-16 animate-pulse rounded-xl bg-bgTertiary" aria-hidden />
              </div>
            ) : null}
            <img
              src={resolvedLogoSrc}
              alt={`${company.name} logo`}
              className={`h-16 w-16 object-contain transition-opacity duration-200 ${logoLoaded ? "opacity-100" : "opacity-0"}`}
              loading="lazy"
              decoding="async"
              onLoad={() => setLogoLoaded(true)}
              onError={() => {
                setLogoLoaded(false);
                if (!logoFallbackUsed) {
                  setLogoFallbackUsed(true);
                  return;
                }
                setLogoFailed(true);
              }}
            />
          </>
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-bgTertiary text-lg font-bold uppercase text-textSecondary">
            {fallbackInitials}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div>
          <p className="font-bold text-brandDark">{company.symbol}</p>
          <p className="line-clamp-1 text-sm text-textSecondary">{company.name}</p>
        </div>
        <p className="font-mono text-3xl font-bold text-textPrimary">{latestPrice != null ? latestPrice.toFixed(2) : "n/a"}</p>
        <span
          className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${
            changePct == null
              ? "bg-bgTertiary text-textMuted"
              : changePct >= 0
                ? "bg-positive/10 text-positive"
                : "bg-negative/10 text-negative"
          }`}
        >
          {changePct == null ? "—" : `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%`}
        </span>
        <span className="mt-1 inline-flex w-fit rounded-full bg-bgTertiary px-2.5 py-1 text-xs font-medium text-textSecondary">
          {company.sector}
        </span>
        <p className="line-clamp-2 text-xs text-textMuted">{company.industry}</p>
      </div>
    </Link>
  );
}
