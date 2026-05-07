/**
 * Phase 11 Sprint 2 — deterministyczny scoring zrównoważenia dywidendy (bez AI).
 * Zobacz: docs/DIVIDEND_SUSTAINABILITY_SCORING.md
 */
export interface SustainabilityBreakdown {
  payoutScore: number;
  coverageScore: number;
  consistencyScore: number;
  /** Ułamek (np. 0.35 = 35%). `null` gdy brak EPS lub DPS. */
  payoutRatio: number | null;
  /** Suma wypłat / FCF (np. 0.6 = dywidenda to 60% FCF). `null` gdy brak FCF lub udziałów. */
  fcfCoverage: number | null;
  /** Ostatnie N lat DPS (totalAmount per rok), rosnąco po roku. */
  dpsHistory: number[];
  /** Wzrost YoY w % dla kolejnych par lat (długość = dpsHistory.length - 1). */
  yoyGrowth: number[];
  /** Ważona suma (Sprint 4 placeholder): round(0.35*payout + 0.35*coverage + 0.30*consistency). */
  finalScore: number;
  explanation: string;
}

/** Wejście do czystej funkcji matematycznej (testy bez DB). */
export interface SustainabilityMathInputs {
  epsTtm: number | null;
  /** Suma wypłat na akcję w ostatnim pełnym roku (DividendHistory.totalAmount). */
  latestAnnualDps: number | null;
  fcf: number | null;
  sharesOutstanding: number | null;
  /** Min. 1 rekord: { year, totalAmount }, preferowane ostatnie 5 lat rosnąco po roku. */
  dividendTotalsByYear: Array<{ year: number; totalAmount: number }>;
}
