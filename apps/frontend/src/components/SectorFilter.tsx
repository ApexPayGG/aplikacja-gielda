import { useTranslation } from "react-i18next";

const SECTORS = [
  "All",
  "Technology",
  "Financial Services",
  "Healthcare",
  "Consumer Cyclical",
  "Industrials",
  "Energy",
  "Communication Services",
  "Consumer Defensive",
  "Utilities",
  "Real Estate",
  "Basic Materials",
] as const;

type Props = {
  value: string;
  onChange: (sector: string) => void;
};

export function SectorFilter({ value, onChange }: Props) {
  const { t } = useTranslation();

  const sectorLabel = (sector: string): string => {
    if (sector === "All") return t("sector.all", { defaultValue: "All" });
    if (sector === "Technology") return t("sector.technology", { defaultValue: "Technology" });
    if (sector === "Financial Services") return t("sector.financialServices", { defaultValue: "Financial Services" });
    if (sector === "Healthcare") return t("sector.healthcare", { defaultValue: "Healthcare" });
    if (sector === "Consumer Cyclical") return t("sector.consumerCyclical", { defaultValue: "Consumer Cyclical" });
    if (sector === "Industrials") return t("sector.industrials", { defaultValue: "Industrials" });
    if (sector === "Energy") return t("sector.energy", { defaultValue: "Energy" });
    if (sector === "Communication Services") return t("sector.communicationServices", { defaultValue: "Communication Services" });
    if (sector === "Consumer Defensive") return t("sector.consumerDefensive", { defaultValue: "Consumer Defensive" });
    if (sector === "Utilities") return t("sector.utilities", { defaultValue: "Utilities" });
    if (sector === "Real Estate") return t("sector.realEstate", { defaultValue: "Real Estate" });
    if (sector === "Basic Materials") return t("sector.basicMaterials", { defaultValue: "Basic Materials" });
    return sector;
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="sector" className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {t("home.sectorLabel", { defaultValue: "Sector" })}
      </label>
      <select
        id="sector"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-[200px] rounded-xl border border-surface-border bg-surface-elevated px-3 py-2.5 text-sm text-slate-100 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      >
        {SECTORS.map((s) => (
          <option key={s} value={s}>
            {sectorLabel(s)}
          </option>
        ))}
      </select>
    </div>
  );
}
