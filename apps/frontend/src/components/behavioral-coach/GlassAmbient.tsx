/** Fixed gradient orbs behind glass pages (terminal cyan / navy glow). */
export function GlassAmbient() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-[#22d3ee]/12 blur-[100px]" />
      <div className="absolute right-0 top-1/4 h-[28rem] w-[28rem] rounded-full bg-[#38bdf8]/10 blur-[120px]" />
      <div className="absolute bottom-0 left-1/4 h-80 w-80 rounded-full bg-[#0891b2]/10 blur-[100px]" />
      <div className="absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#101827]/50 blur-[80px]" />
    </div>
  );
}
