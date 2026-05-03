/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
      },
      colors: {
        surface: {
          DEFAULT: "#0f1419",
          elevated: "#1a2332",
          border: "#2d3a4d",
        },
        accent: {
          DEFAULT: "#3b82f6",
          muted: "#60a5fa",
        },
      },
    },
  },
  plugins: [],
};
