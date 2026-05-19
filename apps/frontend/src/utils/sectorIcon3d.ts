export type SectorIconPack =
  | "finance business"
  | "technology digital"
  | "ecommerce retail"
  | "ui system"
  | "social communication";

const PACK_ICONS: Record<SectorIconPack, string[]> = {
  "finance business": [
    "/icons3d/finance business/icon-1.png",
    "/icons3d/finance business/icon-2.png",
    "/icons3d/finance business/icon-3.png",
    "/icons3d/finance business/icon-4.png",
  ],
  "technology digital": [
    "/icons3d/technology digital/icon-1.png",
    "/icons3d/technology digital/icon-2.png",
    "/icons3d/technology digital/icon-3.png",
    "/icons3d/technology digital/icon-4.png",
  ],
  "ecommerce retail": [
    "/icons3d/ecommerce retail/icon-1.png",
    "/icons3d/ecommerce retail/icon-2.png",
    "/icons3d/ecommerce retail/icon-3.png",
    "/icons3d/ecommerce retail/icon-4.png",
  ],
  "ui system": [
    "/icons3d/ui system/icon-1.png",
    "/icons3d/ui system/icon-2.png",
    "/icons3d/ui system/icon-3.png",
    "/icons3d/ui system/icon-4.png",
  ],
  "social communication": [
    "/icons3d/social communication/icon-1.png",
    "/icons3d/social communication/icon-2.png",
    "/icons3d/social communication/icon-3.png",
    "/icons3d/social communication/icon-4.png",
  ],
};

const DEFAULT_PACK: SectorIconPack = "ui system";

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function resolveSectorIconPack(sector: string | null | undefined): SectorIconPack {
  const value = String(sector ?? "")
    .trim()
    .toLowerCase();

  if (!value) return DEFAULT_PACK;

  if (/(financial|finance|bank|insurance|capital market)/.test(value)) {
    return "finance business";
  }
  if (/(technology|tech|software|semiconductor|digital|communication services|internet)/.test(value)) {
    return "technology digital";
  }
  if (/(consumer|retail|ecommerce|e-commerce|cyclical|discretionary|defensive)/.test(value)) {
    return "ecommerce retail";
  }
  if (/(healthcare|health|pharma|biotech|medical)/.test(value)) {
    return "social communication";
  }

  return DEFAULT_PACK;
}

export function getSector3dIconPath(sector: string | null | undefined, symbol?: string): string {
  const pack = resolveSectorIconPack(sector);
  const icons = PACK_ICONS[pack];
  if (icons.length === 0) return PACK_ICONS[DEFAULT_PACK][0];

  const key = `${symbol ?? ""}:${sector ?? ""}`.trim() || pack;
  const index = hashString(key) % icons.length;
  return icons[index];
}
