export function isMarketEventsEnabled(): boolean {
  return process.env.MARKET_EVENTS_ENABLED !== "0";
}

export function marketEventsSyncHorizonDays(): number {
  const raw = Number(process.env.MARKET_EVENTS_SYNC_HORIZON_DAYS ?? 30);
  if (!Number.isFinite(raw) || raw < 7) return 30;
  return Math.min(Math.floor(raw), 90);
}

export function marketEventsDigestHourUtc(): number {
  const raw = Number(process.env.MARKET_EVENTS_DIGEST_HOUR_UTC ?? 7);
  if (!Number.isFinite(raw)) return 7;
  return Math.min(23, Math.max(0, Math.floor(raw)));
}
