import { useTranslation } from "react-i18next";
import type { DividendDataStatus } from "../../services/api";
import { TERMINAL_DIVIDEND_BADGE } from "../terminal/terminalStyles";

const STATUS_CLASS: Record<DividendDataStatus, string> = {
  confirmed: "text-emerald-300 border-emerald-500/40",
  estimated: "text-amber-300 border-amber-500/40",
  stale: "text-orange-300 border-orange-500/40",
  missing: "text-terminal-textMuted border-terminal-border/60",
};

export function DividendDataStatusBadge({ status }: { status: DividendDataStatus }) {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TERMINAL_DIVIDEND_BADGE} ${STATUS_CLASS[status]}`}
      title={t(`dividend.dataStatusHint.${status}`, {
        defaultValue:
          status === "estimated"
            ? "Estimated date or payout — verify with official sources."
            : status === "stale"
              ? "Data may be outdated — refresh or check the issuer."
              : status === "missing"
                ? "Incomplete dividend record in our database."
                : "Synced dividend event from provider data.",
      })}
    >
      {t(`dividend.dataStatus.${status}`, {
        defaultValue:
          status === "confirmed"
            ? "Confirmed"
            : status === "estimated"
              ? "Estimated"
              : status === "stale"
                ? "Stale"
                : "Missing",
      })}
    </span>
  );
}

export function formatFrequencyLabel(
  frequency: string | null | undefined,
  t: (key: string, opts?: { defaultValue?: string }) => string,
): string {
  if (!frequency?.trim()) {
    return t("dividend.frequencyUnknown", { defaultValue: "—" });
  }
  const key = frequency.trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  const known = ["quarterly", "monthly", "annual", "semi_annual", "weekly", "other"];
  if (known.includes(key)) {
    return t(`dividend.frequency.${key}`, {
      defaultValue: key.replace(/_/g, " "),
    });
  }
  return frequency;
}
