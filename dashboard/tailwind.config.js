/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        neutral: {
          950: "#0a0a0a",
          900: "#141414",
          850: "#1a1a1a",
          800: "#1f1f1f",
          700: "#2e2e2e",
          600: "#3d3d3d",
          500: "#525252",
          400: "#737373",
          300: "#a3a3a3",
          200: "#d4d4d4",
          100: "#f5f5f5",
        },
        accent: "#3b82f6",
        success: "#22c55e",
        error: "#ef4444",
      },
    },
  },
  plugins: [],
};
