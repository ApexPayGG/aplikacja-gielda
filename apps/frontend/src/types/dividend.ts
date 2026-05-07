/** Snapshot Dividend Intelligence (GET /intelligence/dividend/:symbol). */
export interface DividendIntelligence {
  symbol: string;
  safetyScore: number;
  trendDirection: "up" | "down" | "stable";
  sectorPercentile: number;
  safetyReason: string;
}

/** Pojedynczy alert w timeline (GET .../alerts). */
export interface DividendAlert {
  alertType: "dividend_cut" | "dividend_growth" | "anomaly" | "sector_change" | string;
  severity: number;
  message: string;
  createdAt: string;
}

export interface DividendAlertsResponse {
  symbol: string;
  alerts: DividendAlert[];
}

/** Średni safety score per sektor (GET .../comparison/sector). */
export type SectorComparison = Record<string, number>;
