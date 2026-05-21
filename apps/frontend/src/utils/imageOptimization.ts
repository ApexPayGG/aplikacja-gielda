export function normalizeTickerSymbol(symbol: string): string {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) return "";
  return normalized.split(".")[0]?.trim() ?? normalized;
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
