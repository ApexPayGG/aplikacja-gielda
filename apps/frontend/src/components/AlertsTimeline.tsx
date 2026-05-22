import { useTranslation } from "react-i18next";
import type { DividendAlert } from "../types/dividend";
import { resolveIntlLocale } from "../utils/formatters";

export interface AlertsTimelineProps {
  alerts: DividendAlert[];
  symbol: string;
}

function badgeClass(type: string): string {
  switch (type) {
    case "dividend_cut":
      return "bg-red-500/20 text-red-300 border-red-500/40";
    case "dividend_growth":
      return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
    case "anomaly":
      return "bg-amber-500/20 text-amber-200 border-amber-500/40";
    case "sector_change":
      return "bg-sky-500/20 text-sky-200 border-sky-500/40";
    default:
      return "bg-slate-500/20 text-slate-300 border-surface-border";
  }
}

function formatDate(iso: string, language?: string): string {
  try {
    return new Date(iso).toLocaleString(resolveIntlLocale(language));
  } catch {
    return iso;
  }
}

export function AlertsTimeline({ alerts, symbol }: AlertsTimelineProps) {
  const { t, i18n } = useTranslation();
  if (alerts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-surface-border bg-surface-elevated/50 p-8 text-center text-sm text-slate-500">
        {t("alertsTimeline.empty", { defaultValue: "No alerts for {{symbol}}.", symbol })}
      </div>
    );
  }

  return (
    <section className="rounded-lg border border-surface-border bg-surface-elevated p-6">
      <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">Alerts</h2>
      <p className="mt-1 text-xs text-slate-500">
        {t("alertsTimeline.timelineFor", { defaultValue: "Timeline for {{symbol}}", symbol })}
      </p>
      <ol className="relative mt-6 space-y-6 border-l border-surface-border pl-6">
        {alerts.map((a, i) => (
          <li key={`${a.createdAt}-${i}`} className="relative">
            <span className="absolute -left-[29px] top-1 h-3 w-3 rounded-full border-2 border-surface-elevated bg-accent" />
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded border px-2 py-0.5 text-xs font-medium ${badgeClass(a.alertType)}`}>
                {a.alertType.replace(/_/g, " ")}
              </span>
              <span className="text-xs text-slate-500">{formatDate(a.createdAt, i18n.language)}</span>
            </div>
            <div className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-surface">
              <div className="h-full rounded-full bg-accent-muted" style={{ width: `${a.severity}%` }} />
            </div>
            <p className="mt-2 text-sm text-slate-300">{a.message}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
