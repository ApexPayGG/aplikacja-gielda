/** Single brand asset used across the entire app. */
export const BRAND_LOGO_SRC = "/logo.png";

type BrandLogoSize = "nav" | "footer" | "auth" | "loading" | "card" | "cardLg" | "hero" | "badge" | "mini";

const SIZE_CLASSES: Record<BrandLogoSize, string> = {
  nav: "h-12 w-auto max-w-[min(100%,380px)]",
  footer: "h-14 w-auto max-w-[min(100%,360px)] md:h-16 md:max-w-[420px]",
  auth: "h-14 w-auto max-w-[min(100%,380px)] md:h-16",
  loading: "h-16 w-auto max-w-[min(100%,400px)]",
  card: "h-16 w-auto max-w-full",
  cardLg: "h-20 w-auto max-w-full sm:h-24",
  hero: "h-10 w-auto max-w-[220px] sm:h-11",
  badge: "h-14 w-auto max-w-[88px]",
  mini: "h-8 w-auto max-w-[140px]",
};

type BrandLogoProps = {
  size?: BrandLogoSize;
  className?: string;
};

export function BrandLogo({ size = "nav", className = "" }: BrandLogoProps) {
  const sizeClass = SIZE_CLASSES[size];
  return (
    <img
      src={BRAND_LOGO_SRC}
      alt="Stock-AI.Pro"
      className={[sizeClass, "object-contain object-left", className].filter(Boolean).join(" ")}
      decoding="async"
    />
  );
}

export function CardBrandMark({ className = "" }: { className?: string }) {
  return (
    <div className={["mb-5 flex w-full justify-center sm:justify-start", className].filter(Boolean).join(" ")}>
      <BrandLogo size="cardLg" className="mx-auto sm:mx-0" />
    </div>
  );
}
