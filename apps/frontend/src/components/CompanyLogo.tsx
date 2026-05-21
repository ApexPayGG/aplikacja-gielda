import { useEffect, useState } from "react";
import { normalizeTickerSymbol } from "../utils/imageOptimization";

export type CompanyLogoSize = "xs" | "sm" | "md" | "lg";

const SIZE_STYLES: Record<CompanyLogoSize, { box: string; text: string }> = {
  xs: { box: "h-8 w-8", text: "text-[10px] leading-none" },
  sm: { box: "h-10 w-10", text: "text-xs leading-none" },
  md: { box: "h-12 w-12", text: "text-sm leading-none" },
  lg: { box: "h-20 w-20", text: "text-base leading-none" },
};

export function formatCompanyTickerLabel(symbol: string): string {
  const normalized = normalizeTickerSymbol(symbol);
  if (!normalized) return "—";
  const base = normalized.replace(/[^A-Z0-9]/g, "");
  if (!base) return "—";
  if (base.length <= 4) return base;
  return base.slice(0, 4);
}

export function resolveCompanyLogoUrl(logoUrl?: string | null, logo?: string | null): string | null {
  const candidate = (logoUrl ?? logo)?.trim();
  return candidate || null;
}

type CompanyLogoProps = {
  symbol: string;
  logoUrl?: string | null;
  logo?: string | null;
  size?: CompanyLogoSize;
  shape?: "circle" | "rounded";
  className?: string;
  alt?: string;
};

export function CompanyLogo({
  symbol,
  logoUrl,
  logo,
  size = "md",
  shape = "rounded",
  className = "",
  alt,
}: CompanyLogoProps) {
  const src = resolveCompanyLogoUrl(logoUrl, logo);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const showImage = Boolean(src) && !failed;
  const sizeStyle = SIZE_STYLES[size];
  const shapeClass = shape === "circle" ? "rounded-full" : "rounded-lg";
  const shellClass = [
    "flex shrink-0 items-center justify-center overflow-hidden border border-white/10",
    "bg-gradient-to-br from-[#1e1b4b]/80 via-[#0f111c]/90 to-[#0a0b14]/95 backdrop-blur-sm",
    shapeClass,
    sizeStyle.box,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (showImage) {
    return (
      <div className={`${shellClass} p-1`} aria-hidden={alt ? undefined : true}>
        <img
          src={src!}
          alt={alt ?? `${symbol} logo`}
          className="h-full w-full object-contain"
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div className={`${shellClass} font-bold uppercase tracking-tight text-[#22d3ee]`} aria-label={alt ?? symbol}>
      <span className={sizeStyle.text}>{formatCompanyTickerLabel(symbol)}</span>
    </div>
  );
}
