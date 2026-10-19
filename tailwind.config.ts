import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "media",
  theme: {
    extend: {
      fontFamily: {
        display: ["ui-serif", "Iowan Old Style", "Palatino", "Georgia", "serif"],
        sans: ["ui-sans-serif", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Inter", "sans-serif"],
      },
      colors: {
        paper: "rgb(var(--paper) / <alpha-value>)",
        card: "rgb(var(--card) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
      },
    },
  },
} satisfies Config;
