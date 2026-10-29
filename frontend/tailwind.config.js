/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Cairo", "sans-serif"],
      },
      colors: {
        brand: {
          dark: "#0f172a",
          gold: "#d4af37",
          bg: "#f8fafc",
        },
        dash: {
          primary: "#2c3e50",
          accent: "#f39c12",
        },
      },
      direction: ["ltr", "rtl"],
    },
  },
  plugins: [],
};
