/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Bricolage Grotesque", "Hanken Grotesk", "sans-serif"],
        body: ["Hanken Grotesk", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      colors: {
        ink: { 900: "#06080d", 850: "#0a0d14", 800: "#0d111a", 770: "#111725", 700: "#161d2c" },
        hi: "#eef2fb",
        body: "#a9b4c9",
        dim: "#66718a",
        amber: { DEFAULT: "#f5b13d", deep: "#c8851f" },
        go: "#4ad6a0",
        hold: "#f6c453",
        stop: "#ff6f6f",
        cyan: "#5ec8e0",
        line: "rgba(150,172,210,0.20)",
      },
    },
  },
  plugins: [],
};
