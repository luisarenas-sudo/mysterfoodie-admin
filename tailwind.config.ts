import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#222222",
        paper: "#ffffff",
        brand: {
          50: "#fef2f1",
          100: "#fde1de",
          200: "#fbc0ba",
          300: "#f89c8f",
          400: "#f56a56",
          500: "#f24444",
          600: "#d93a3a",
          700: "#b32e2e",
          orange: "#f25631",
        },
        status: {
          excellent: "#15803d",
          good: "#ca8a04",
          fair: "#c2410c",
          critical: "#dc2626",
        },
      },
      fontFamily: {
        sans: ["var(--font-poppins)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-fredoka)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(180deg, #f24444 0%, #f25631 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
