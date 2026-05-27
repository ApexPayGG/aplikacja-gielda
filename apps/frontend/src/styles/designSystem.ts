/** Shared color tokens — terminal dark palette (legacy export shape preserved). */
export const colors = {
  // Backgrounds
  bgPrimary: "#0B1220",
  bgSecondary: "#101827",
  bgTertiary: "#1a2332",

  // Brand / accent (cyan-first; brandDark = text on cyan CTAs)
  brandDark: "#020617",
  brandMedium: "#0891b2",
  brandCyan: "#22d3ee",
  brandIndigo: "#101827",
  brandGold: "#fbbf24",

  // Semantic
  positive: "#4ade80",
  negative: "#f87171",
  neutral: "#94a3b8",

  // Text
  textPrimary: "#f8fafc",
  textSecondary: "#94a3b8",
  textMuted: "#64748b",

  // Borders
  border: "rgba(148, 163, 184, 0.14)",
  borderStrong: "rgba(56, 189, 248, 0.16)",
} as const;
