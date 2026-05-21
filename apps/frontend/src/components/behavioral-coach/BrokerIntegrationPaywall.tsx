import { LockClosedIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { Link } from "react-router-dom";
import { GLASS_SECTION } from "./glassStyles";

export function BrokerIntegrationPaywall() {
  return (
    <section
      className={`${GLASS_SECTION} relative overflow-hidden border-[#22d3ee]/20 bg-gradient-to-br from-[#a855f7]/25 via-[#0f111c]/50 to-[#0a0b14]/80`}
    >
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[#22d3ee]/10 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-16 left-8 h-48 w-48 rounded-full bg-[#1e1b4b]/40 blur-3xl" aria-hidden />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-4">
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-[#1e1b4b]/30 text-[#22d3ee] backdrop-blur-md">
            <LockClosedIcon className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#22d3ee]">StockAI Pro+</p>
            <h2 className="mt-1 text-lg font-bold text-white">Integracja z brokerem na żywo</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/70">
              Automatyczna integracja z API brokera (np. eToro, Interactive Brokers) w celu analizy emocji na żywo jest
              dostępna w planie <span className="font-semibold text-[#22d3ee]">PRO+</span>.
            </p>
          </div>
        </div>

        <Link
          to="/pricing"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-[#22d3ee]/30 bg-[#22d3ee]/15 px-5 py-3 text-sm font-semibold text-[#22d3ee] transition hover:border-[#22d3ee]/50 hover:bg-[#22d3ee]/25"
        >
          <SparklesIcon className="h-4 w-4" aria-hidden />
          Odblokuj PRO+
        </Link>
      </div>
    </section>
  );
}
