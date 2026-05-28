import { SparklesIcon } from "@heroicons/react/24/solid";
import { Link } from "react-router-dom";
import type { Company } from "../services/api";
import {
  formatStockPrice,
  isPremiumLockedSymbol,
  mockQuoteFromSymbol,
} from "../utils/companyCardDisplay";
import { CompanyLogo } from "./CompanyLogo";
import {
  TERMINAL_BADGE,
  TERMINAL_COMPANY_CARD,
  TERMINAL_LINK_ACCENT,
} from "./terminal/terminalStyles";
import { WatchlistButton } from "./WatchlistButton";

type Props = {
  company: Company;
  onOpenBrief?: (company: Company) => void;
  /** @deprecated `glass` maps to terminal styling. */
  variant?: "terminal" | "glass";
};

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function CompanyCard({ company, onOpenBrief, variant: _variant = "terminal" }: Props) {
  const cardShell = TERMINAL_COMPANY_CARD;

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

  const changeBadgeClass = isPositive
    ? "bg-terminal-cyan/10 text-terminal-positive"
    : "bg-terminal-negative/10 text-terminal-negative";

  return (
    <div className={cardShell}>
      <Link
        to={cardTo}
        className="absolute inset-0 z-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-terminal-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-terminal-bg"
        aria-label={cardAriaLabel}
      />

      <div className="pointer-events-none relative z-10 flex flex-1 flex-col">
        <div className="pointer-events-auto absolute right-3 top-3 z-20">
          <WatchlistButton symbol={company.symbol} />
        </div>

        <div className="relative flex h-24 items-center justify-center border-b border-terminal-borderMuted bg-gradient-to-b from-terminal-cyan/10 to-transparent p-4">
          <CompanyLogo symbol={company.symbol} logoUrl={company.logoUrl} size="md" shape="circle" />
        </div>

        <div className="relative flex flex-1 flex-col gap-2 p-4">
          <div>
            <p className="font-mono text-sm font-bold text-terminal-cyan">{company.symbol}</p>
            <p className="line-clamp-1 text-sm text-terminal-textSecondary">{company.name}</p>
          </div>

          <div className="relative">
            {isLocked ? (
              <div className="relative overflow-hidden rounded-lg">
                <div className="pointer-events-none select-none blur-[3px]" aria-hidden>
                  <p className="font-mono text-2xl font-bold text-terminal-text">{priceLabel}</p>
                  <span className={`mt-2 inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${changeBadgeClass}`}>
                    {`${isPositive ? "+" : ""}${changePct.toFixed(2)}%`}
                  </span>
                </div>
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-terminal-bg/50 backdrop-blur-sm">
                  <span className={`${TERMINAL_BADGE} border-terminal-cyan/30 text-terminal-cyan`}>PRO</span>
                </div>
              </div>
            ) : (
              <>
                <p className="font-mono text-2xl font-bold text-terminal-text">{priceLabel}</p>
                <span className={`mt-2 inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${changeBadgeClass}`}>
                  {`${isPositive ? "+" : ""}${changePct.toFixed(2)}%`}
                </span>
              </>
            )}
          </div>

          <span className={`${TERMINAL_BADGE} mt-1 w-fit`}>{company.sector}</span>
          <p className="line-clamp-2 text-xs text-terminal-textMuted">{company.industry}</p>

          {!isLocked ? (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onOpenBrief?.(company);
              }}
              className={`pointer-events-auto relative z-20 mt-2 inline-flex w-fit items-center gap-1.5 text-sm ${TERMINAL_LINK_ACCENT} focus:outline-none focus-visible:ring-2 focus-visible:ring-terminal-cyan`}
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
