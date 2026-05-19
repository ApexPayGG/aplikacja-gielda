import {
  BoltIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import type { CoachIntervention } from "../../utils/behavioralCoachData";
import { GLASS_SECTION, GLASS_SECTION_TITLE } from "./glassStyles";

type Props = {
  interventions: CoachIntervention[];
  loading?: boolean;
};

function interventionIcon(type: CoachIntervention["type"]) {
  if (type === "revenge") return BoltIcon;
  if (type === "fomo") return ExclamationTriangleIcon;
  if (type === "discipline") return ShieldCheckIcon;
  return SparklesIcon;
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "—";
  const now = Date.now();
  const diffMs = now - date.getTime();
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  if (hours < 1) return "Przed chwilą";
  if (hours < 24) return `${hours} h temu`;
  const days = Math.floor(hours / 24);
  return `${days} dni temu`;
}

export function CoachInterventionsSection({ interventions, loading }: Props) {
  return (
    <section className={GLASS_SECTION}>
      <h2 className={GLASS_SECTION_TITLE}>Ostatnie Interwencje Coacha</h2>
      <p className="mt-1 text-sm text-white/55">Timeline alertów AI chroniących kapitał przed typowymi błędami behawioralnymi.</p>

      {loading ? (
        <ul className="mt-5 space-y-3" aria-hidden>
          {Array.from({ length: 4 }).map((_, idx) => (
            <li key={`sk-int-${idx}`} className="h-20 animate-pulse rounded-xl bg-white/5" />
          ))}
        </ul>
      ) : (
        <ol className="relative mt-6 space-y-0 border-l border-[#00C9D4]/30 pl-6">
          {interventions.map((item, index) => {
            const Icon = interventionIcon(item.type);
            const isLast = index === interventions.length - 1;
            return (
              <li key={item.id} className={`relative ${isLast ? "" : "pb-8"}`}>
                <span
                  className="absolute -left-[1.9rem] top-1 flex h-8 w-8 items-center justify-center rounded-full border border-[#00C9D4]/40 bg-[#2D0A6B]/80 text-[#00C9D4] shadow-[0_0_16px_rgba(0,201,212,0.25)]"
                  aria-hidden
                >
                  <Icon className="h-4 w-4" />
                </span>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#00C9D4]/80">{formatWhen(item.at)}</p>
                <p className="mt-1 text-sm leading-relaxed text-white/85">{item.message}</p>
                {typeof item.savedUsd === "number" ? (
                  <p className="mt-2 inline-flex rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
                    Oszczędność: ${item.savedUsd}
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
