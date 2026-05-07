import type { NormalizedDividendRow } from "../scrapers/dividends";

export interface DividendQualityReport {
  ok: boolean;
  issues: string[];
  dropped: number;
  kept: number;
}

/** Drop invalid rows; log-style issues for monitoring. */
export function filterValidNormalizedDividends(rows: NormalizedDividendRow[]): {
  valid: NormalizedDividendRow[];
  report: DividendQualityReport;
} {
  const issues: string[] = [];
  let dropped = 0;
  const valid: NormalizedDividendRow[] = [];
  const now = Date.now();
  const maxFuture = 86400000 * 370;

  for (const r of rows) {
    if (!(r.amount > 0) || !Number.isFinite(r.amount)) {
      dropped++;
      issues.push("non_positive_amount");
      continue;
    }
    const ex = r.exDate.getTime();
    if (Number.isNaN(ex)) {
      dropped++;
      issues.push("invalid_exDate");
      continue;
    }
    if (ex > now + maxFuture) {
      dropped++;
      issues.push("exDate_too_far_future");
      continue;
    }
    valid.push(r);
  }

  return {
    valid,
    report: {
      ok: valid.length > 0,
      issues: [...new Set(issues)],
      dropped,
      kept: valid.length,
    },
  };
}
