import { SparklesIcon } from "@heroicons/react/24/solid";
import { Link } from "react-router-dom";
import type { Company } from "../services/api";
import {
  formatStockPrice,
  isPremiumLockedSymbol,
  mockQuoteFromSymbol,
} from "../utils/companyCardDisplay";
import { BrandLogo } from "./BrandLogo";
import { WatchlistButton } from "./WatchlistButton";

type Props = {
  company: Company;
  onOpenBrief?: (company: Company) => void;
};

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

const GLASS_ICON_SHELL =
  "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#2D0A6B]/10 bg-[#2D0A6B]/5 p-2 shadow-sm backdrop-blur-sm";

export function CompanyCard({ company, onOpenBrief }: Props) {
  const companyMeta = company as Company & {
    price?: number | string | null;
    close?: number | string | null;
    lastPrice?: number | string | null;
    changePct?: number | string | null;
    changePercent?: number | string | null;
  };

  const apiPrice = readNumber(companyMeta.price ?? companyMeta.close ?? companyMeta.lastPrice);
  const apiChangePct = readNumber(companyMeta.changePct ?? companyMeta.changePercent);
  const mock = mockQuoteFromSymbol(company.symbol);

  const latestPrice = apiPrice ?? mock.price;
  const changePct = apiChangePct ?? mock.changePct;
  const isLocked = isPremiumLockedSymbol(company.symbol);
  const priceLabel = formatStockPrice(latestPrice, company.symbol);
  const isPositive = changePct >= 0;

  const cardTo = isLocked
    ? `/company/${encodeURIComponent(company.symbol)}/premium`
    : `/company/${encodeURIComponent(company.symbol)}`;

  const cardAriaLabel = `${company.name} (${company.symbol})`;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-bgPrimary shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
      <Link
        to={cardTo}
        className="absolute inset-0 z-0 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00C9D4] focus-visible:ring-offset-2"
        aria-label={cardAriaLabel}
      />

      <div className="pointer-events-none relative z-10 flex flex-1 flex-col">
        <div className="pointer-events-auto absolute right-3 top-3 z-20">
          <WatchlistButton symbol={company.symbol} />
        </div>

        <div className="relative flex h-28 items-center justify-center bg-gradient-to-b from-[#2D0A6B]/[0.04] to-transparent p-4">
          <div className={GLASS_ICON_SHELL}>
            <BrandLogo size="mini" className="h-full max-h-10 w-full max-w-full object-contain" />
          </div>
        </div>

        <div className="relative flex flex-1 flex-col gap-2 p-4">
          <div>
            <p className="font-bold text-brandDark">{company.symbol}</p>
            <p className="line-clamp-1 text-sm text-textSecondary">{company.name}</p>
          </div>

          <div className="relative">
            {isLocked ? (
              <div className="relative overflow-hidden rounded-xl">
                <div className="pointer-events-none select-none blur-[3px]" aria-hidden>
                  <p className="font-mono text-3xl font-bold text-textPrimary">{priceLabel}</p>
                  <span
                    className={`mt-2 inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${
                      isPositive ? "bg-[#00C9D4]/10 text-[#00A86B]" : "bg-red-500/10 text-red-500"
                    }`}
                  >
                    {`${isPositive ? "+" : ""}${changePct.toFixed(2)}%`}
                  </span>
                </div>
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/5 backdrop-blur-[2px]">
                  <span className="rounded-full border border-[#2D0A6B]/20 bg-[#2D0A6B] px-3 py-1 text-xs font-bold tracking-wide text-white shadow-sm">
                    PRO
                  </span>
                </div>
              </div>
            ) : (
              <>
                <p className="font-mono text-3xl font-bold text-textPrimary">{priceLabel}</p>
                <span
                  className={`mt-2 inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${
                    isPositive ? "bg-[#00C9D4]/10 text-[#00A86B]" : "bg-red-500/10 text-red-500"
                  }`}
                >
                  {`${isPositive ? "+" : ""}${changePct.toFixed(2)}%`}
                </span>
              </>
            )}
          </div>

          <span className="mt-1 inline-flex w-fit rounded-full bg-[#2D0A6B]/5 px-2.5 py-1 text-xs font-medium text-[#2D0A6B]">
            {company.sector}
          </span>
          <p className="line-clamp-2 text-xs text-textMuted">{company.industry}</p>

          {!isLocked ? (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onOpenBrief?.(company);
              }}
              className="pointer-events-auto relative z-20 mt-2 inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-[#00C9D4] transition hover:text-[#2D0A6B] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00C9D4] focus-visible:ring-offset-2"
            >
              <SparklesIcon className="h-4 w-4" aria-hidden />
              AI Brief
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
