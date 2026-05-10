/** Human-readable age of a quote timestamp (UTC ISO string). */
export function formatQuoteAge(iso: string, nowMs = Date.now()): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const sec = Math.floor((nowMs - t) / 1000);
  if (sec < 0) return "0s";
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}
