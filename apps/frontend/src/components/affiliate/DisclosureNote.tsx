import { useTranslation } from "react-i18next";

type DisclosureBroker = {
  slug: string;
  riskWarning?: Record<string, unknown> | null;
};

type DisclosureNoteProps = {
  broker?: DisclosureBroker | null;
  variant?: "inline" | "full";
};

function isCfdBroker(slug: string): boolean {
  const v = slug.trim().toLowerCase();
  return v === "xtb" || v === "etoro";
}

export function DisclosureNote({ broker, variant = "inline" }: DisclosureNoteProps) {
  const { t } = useTranslation("common");
  const showCfd = broker ? isCfdBroker(broker.slug) : false;

  if (variant === "full") {
    return (
      <div className="rounded-lg border border-surface-border bg-surface-elevated p-3 text-xs text-slate-300">
        <p className="font-semibold text-white">
          {t("affiliate.disclosure.title", { defaultValue: "StockAI Pro transparency" })}
        </p>
        <p className="mt-1">
          {t("affiliate.disclosure.full", {
            defaultValue:
              "When you open an account through a recommended broker, we may receive an affiliate commission. It does not affect our recommendations.",
          })}
        </p>
        {showCfd && (
          <p className="mt-2 text-red-300">
            {t("affiliate.disclosure.cfd_warning", {
              pct: 78,
              defaultValue:
                "78% of retail investor accounts lose money when trading CFDs with this provider.",
            })}
          </p>
        )}
      </div>
    );
  }

  return (
    <p className="mt-2 text-xs text-slate-400">
      {t("affiliate.disclosure.short", {
        defaultValue:
          "We receive a broker commission for new accounts. This does not affect our recommendations.",
      })}
    </p>
  );
}
