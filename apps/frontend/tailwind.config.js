/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        bgPrimary: "#FFFFFF",
        bgSecondary: "#F4F6FA",
        bgTertiary: "#ECEEF5",
        bgDeep: "#0a0b14",
        bgElevated: "#0f111c",
        brandDark: "#a855f7",
        brandMedium: "#9333ea",
        brandCyan: "#22d3ee",
        brandIndigo: "#1e1b4b",
        brandGold: "#FFAE33",
        positive: "#4ade80",
        negative: "#f87171",
        neutral: "#94a3b8",
        textPrimary: "#0D0D1A",
        textSecondary: "#5A5A7A",
        textMuted: "#94a3b8",
        border: "#E2E6F0",
        borderStrong: "#C8CCE0",
        brand: {
          bg: "#FFFFFF",
          text: "#0D0D1A",
          neutral: "#94a3b8",
          green: "#4ade80",
          blue: "#22d3ee",
          red: "#f87171",
          violet: "#a855f7",
          amber: "#FFAE33",
          border: "#E2E6F0",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          elevated: "#F4F6FA",
          border: "#E2E6F0",
        },
        accent: {
          DEFAULT: "#a855f7",
          muted: "#94a3b8",
        },
      },
    },
  },
  plugins: [],
};
