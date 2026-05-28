import {
  BoltIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";
import type { CoachIntervention } from "../../utils/behavioralCoachData";
import { GLASS_SECTION, GLASS_SECTION_TITLE } from "./glassStyles";

type Props = {
  interventions: CoachIntervention[];
  loading?: boolean;
};

const INTERVENTION_DEFAULTS: Record<string, string> = {
  "coach.interventions.revengeNvda":
    "Revenge trading attempt detected on NVDA.US. A 15-minute trade block helped preserve $320.",
  "coach.interventions.fomoAbbn":
    "FOMO alert: You closed ABBN too early during market panic. Coach recommends a cool-down before the next entry.",
  "coach.interventions.disciplineSaved":
    "Discipline maintained: you rejected 2 impulsive off-plan entries. Estimated capital saved: $145.",
  "coach.interventions.overtradingLimit":
    "Daily trade limit of 3 exceeded. Coach enabled caution mode for the next 4 hours of the session.",
  "coach.interventions.holdingLosers":
    "“Holding losers” pattern detected in the last 12 trades. Consider a tighter stop-loss and earlier exits.",
};

function interventionIcon(type: CoachIntervention["type"]) {
  if (type === "revenge") return BoltIcon;
  if (type === "fomo") return ExclamationTriangleIcon;
  if (type === "discipline") return ShieldCheckIcon;
  return SparklesIcon;
}

export function CoachInterventionsSection({ interventions, loading }: Props) {
  const { t } = useTranslation();

  const formatWhen = (iso: string): string => {
    const date = new Date(iso);
    if (!Number.isFinite(date.getTime())) return "—";
    const now = Date.now();
    const diffMs = now - date.getTime();
    const hours = Math.floor(diffMs / (60 * 60 * 1000));
    if (hours < 1) return t("coach.time.justNow", { defaultValue: "Just now" });
    if (hours < 24) return t("coach.time.hoursAgo", { count: hours, defaultValue: "{{count}} h ago" });
    const days = Math.floor(hours / 24);
    return t("coach.time.daysAgo", { count: days, defaultValue: "{{count}} d ago" });
  };

  return (
    <section className={GLASS_SECTION}>
      <h2 className={GLASS_SECTION_TITLE}>
        {t("coach.interventions.title", { defaultValue: "Recent coach interventions" })}
      </h2>
      <p className="mt-1 text-sm text-terminal-textMuted">
        {t("coach.interventions.subtitle", {
          defaultValue: "AI alert timeline protecting capital from common behavioral mistakes.",
        })}
      </p>

      {loading ? (
        <ul className="mt-5 space-y-3" aria-hidden>
          {Array.from({ length: 4 }).map((_, idx) => (
            <li key={`sk-int-${idx}`} className="h-20 animate-pulse rounded-lg bg-terminal-panelSecondary" />
          ))}
        </ul>
      ) : (
        <ol className="relative mt-6 space-y-0 border-l border-terminal-cyan/30 pl-6">
          {interventions.map((item, index) => {
            const Icon = interventionIcon(item.type);
            const isLast = index === interventions.length - 1;
            return (
              <li key={item.id} className={`relative ${isLast ? "" : "pb-8"}`}>
                <span
                  className="absolute -left-[1.9rem] top-1 flex h-8 w-8 items-center justify-center rounded-full border border-terminal-cyan/40 bg-terminal-panel text-terminal-cyan shadow-terminal-glow"
                  aria-hidden
                >
                  <Icon className="h-4 w-4" />
                </span>
                <p className="text-xs font-semibold uppercase tracking-wide text-terminal-cyan/80">{formatWhen(item.at)}</p>
                <p className="mt-1 text-sm leading-relaxed text-terminal-text">
                  {t(item.messageKey, {
                    defaultValue: INTERVENTION_DEFAULTS[item.messageKey] ?? item.messageKey,
                  })}
                </p>
                {typeof item.savedUsd === "number" ? (
                  <p className="mt-2 inline-flex rounded-full border border-terminal-positive/30 bg-terminal-positive/10 px-2.5 py-0.5 text-xs font-semibold text-terminal-positive">
                    {t("coach.interventions.savedUsd", {
                      amount: item.savedUsd,
                      defaultValue: "Saved: ${{amount}}",
                    })}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
