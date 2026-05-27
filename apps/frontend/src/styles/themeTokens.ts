/** STOCKAI terminal palette (dark institutional fintech). */
export const stockaiTheme = {
  bgDeep: "#050914",
  bgAlt: "#070B16",
  bgElevated: "#0B1220",
  bgPanelSecondary: "#101827",
  cyan: "#22d3ee",
  cyanStrong: "#38bdf8",
  cyanDark: "#0891b2",
  textPrimary: "#f8fafc",
  textMuted: "#94a3b8",
  textSubtle: "#64748b",
  positive: "#4ade80",
  negative: "#f87171",
  warning: "#fbbf24",
  border: "rgba(56, 189, 248, 0.16)",
  borderMuted: "rgba(148, 163, 184, 0.14)",
  buttonText: "#020617",
} as const;

/** @deprecated Use stockaiTheme — kept for backward compatibility */
export const stockaiThemeLegacy = {
  bgDeep: stockaiTheme.bgDeep,
  bgElevated: stockaiTheme.bgElevated,
  bgIndigo: stockaiTheme.bgPanelSecondary,
  purple: stockaiTheme.cyanStrong,
  purpleMid: stockaiTheme.cyan,
  purpleDeep: stockaiTheme.cyanDark,
  cyan: stockaiTheme.cyan,
  textMuted: stockaiTheme.textMuted,
  positive: stockaiTheme.positive,
  negative: stockaiTheme.negative,
} as const;
