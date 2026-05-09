/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          bg: "rgb(var(--color-brand-bg) / <alpha-value>)",
          text: "rgb(var(--color-brand-text) / <alpha-value>)",
          neutral: "rgb(var(--color-brand-neutral) / <alpha-value>)",
          green: "rgb(var(--color-brand-green) / <alpha-value>)",
          blue: "rgb(var(--color-brand-blue) / <alpha-value>)",
          red: "rgb(var(--color-brand-red) / <alpha-value>)",
          violet: "rgb(var(--color-brand-violet) / <alpha-value>)",
          amber: "rgb(var(--color-brand-amber) / <alpha-value>)",
          border: "rgb(var(--color-brand-border) / <alpha-value>)",
        },
        surface: {
          DEFAULT: "rgb(var(--color-brand-bg) / <alpha-value>)",
          elevated: "#141920",
          border: "rgb(var(--color-brand-border) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--color-brand-amber) / <alpha-value>)",
          muted: "rgb(var(--color-brand-neutral) / <alpha-value>)",
        },
      },
    },
  },
  plugins: [],
};
