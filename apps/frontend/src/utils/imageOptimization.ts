import { getSector3dIconPath } from "./sectorIcon3d";

const symbolDomainMap: Record<string, string> = {
  AAPL: "apple.com",
  AMZN: "amazon.com",
  GOOGL: "google.com",
  META: "meta.com",
  MSFT: "microsoft.com",
  NFLX: "netflix.com",
  NVDA: "nvidia.com",
  TSLA: "tesla.com",
};

function toClearbitUrl(domain: string): string {
  return `https://logo.clearbit.com/${encodeURIComponent(domain)}?size=128&format=png`;
}

export function normalizeTickerSymbol(symbol: string): string {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) return "";
  return normalized.split(".")[0]?.trim() ?? normalized;
}

export function getLogoFallbackUrl(symbol: string, sector?: string | null): string {
  const normalized = normalizeTickerSymbol(symbol);
  if (!normalized) return getSector3dIconPath(sector, symbol);
  return getSector3dIconPath(sector, symbol);
}

export function getOptimizedLogoUrl(symbol: string): string {
  const normalized = normalizeTickerSymbol(symbol);
  if (!normalized) return getLogoFallbackUrl(symbol);
  const domain = symbolDomainMap[normalized] ?? `${normalized.toLowerCase()}.com`;
  return toClearbitUrl(domain);
}

function applyLazyAttributesToImage(image: HTMLImageElement): void {
  if (!image.hasAttribute("loading")) image.loading = "lazy";
  if (!image.hasAttribute("decoding")) image.decoding = "async";
}

export function applyLazyLoadingToImages(root: ParentNode = document): void {
  root.querySelectorAll("img").forEach((image) => {
    applyLazyAttributesToImage(image);
  });
}

export function enableGlobalImageLazyLoading(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  applyLazyLoadingToImages(document);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.tagName === "IMG") {
          applyLazyAttributesToImage(node as HTMLImageElement);
          continue;
        }
        node.querySelectorAll("img").forEach((image) => {
          applyLazyAttributesToImage(image);
        });
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}
