/** @type {import('tailwindcss').Config} */
export default {
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
        brandDark: "#2D0A6B",
        brandMedium: "#7A0F9E",
        brandCyan: "#00C9D4",
        brandGold: "#FFAE33",
        positive: "#00A86B",
        negative: "#E53935",
        neutral: "#5A5A7A",
        textPrimary: "#0D0D1A",
        textSecondary: "#5A5A7A",
        textMuted: "#9B9BB5",
        border: "#E2E6F0",
        borderStrong: "#C8CCE0",
        brand: {
          bg: "#FFFFFF",
          text: "#0D0D1A",
          neutral: "#5A5A7A",
          green: "#00A86B",
          blue: "#00C9D4",
          red: "#E53935",
          violet: "#7A0F9E",
          amber: "#FFAE33",
          border: "#E2E6F0",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          elevated: "#F4F6FA",
          border: "#E2E6F0",
        },
        accent: {
          DEFAULT: "#2D0A6B",
          muted: "#5A5A7A",
        },
      },
    },
  },
  plugins: [],
};
