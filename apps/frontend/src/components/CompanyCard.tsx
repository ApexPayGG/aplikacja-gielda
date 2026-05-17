import { BuildingOffice2Icon } from "@heroicons/react/24/outline";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Company } from "../services/api";
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
    const symbol = String(company.symbol ?? "").trim().toUpperCase();
    if (!symbol) return undefined;

    const [baseSymbol, exchangeFromSymbol] = symbol.split(".");
    const exchange = String(company.exchange ?? exchangeFromSymbol ?? "US")
      .trim()
      .toUpperCase();
    if (!baseSymbol || !exchange) return undefined;

    return `https://eodhd.com/img/logos/${encodeURIComponent(exchange)}/${encodeURIComponent(baseSymbol)}.png`;
  }, [company.exchange, company.symbol]);
  const showLogo = Boolean(logoSrc) && !logoFailed;

  return (
    <Link
      to={`/company/${encodeURIComponent(company.symbol)}/premium`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-bgPrimary shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="absolute right-3 top-3 z-10">
        <WatchlistButton symbol={company.symbol} />
      </div>
      <div className="flex h-28 items-center justify-center bg-bgSecondary p-4">
        {showLogo ? (
          <img
            src={logoSrc}
            alt={`${company.name} logo`}
            className="h-16 w-16 object-contain"
            loading="lazy"
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <BuildingOffice2Icon className="h-14 w-14 text-textMuted" aria-hidden />
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
