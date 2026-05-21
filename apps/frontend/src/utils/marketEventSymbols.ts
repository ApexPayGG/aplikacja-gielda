/**
 * Mirrors backend watchlistEntryMatchesEventSymbol — safe MVP, no fuzzy guessing.
 * AAPL ↔ AAPL.US, CPS ↔ CPS.WAR (via startsWith), not aggressive fuzzy match.
 */
export function watchlistEntryMatchesEventSymbol(watchlistSymbol: string, eventSymbol: string): boolean {
  const wl = watchlistSymbol.trim().toUpperCase();
  const ev = eventSymbol.trim().toUpperCase();
  if (!wl || !ev) return false;
  if (wl === ev) return true;
  const wlBase = wl.split(".")[0] ?? wl;
  const evBase = ev.split(".")[0] ?? ev;
  if (wlBase !== evBase) return false;
  if (wl.includes(".")) {
    return ev === wlBase || ev.startsWith(`${wlBase}.`);
  }
  if (ev === `${wlBase}.US`) return wlBase.length >= 4;
  return ev.startsWith(`${wlBase}.`) && ev !== `${wlBase}.US`;
}

export function eventMatchesWatchlistSymbol(eventSymbol: string | null, watchlistSymbols: string[]): boolean {
  if (!eventSymbol?.trim()) return false;
  const sym = eventSymbol.trim().toUpperCase();
  return watchlistSymbols.some((wl) => watchlistEntryMatchesEventSymbol(wl, sym));
}
