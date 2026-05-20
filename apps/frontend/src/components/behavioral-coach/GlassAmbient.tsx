/** Fixed gradient orbs behind glass pages */
export function GlassAmbient() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-[#2D0A6B]/40 blur-3xl" />
      <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-[#00C9D4]/12 blur-3xl" />
      <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-[#7A0F9E]/20 blur-3xl" />
    </div>
  );
}
