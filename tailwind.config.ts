import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "midnight-navy": "#060B18",
        "procurement-blue": "#1D4ED8",
        "ledger-cyan": "#22D3EE",
        "award-gold": "#F5B841",
        "compliance-green": "#2CE88A",
        "risk-red": "#FF4D5E",
        "paper-white": "#F7F3EA",
        "slate-grey": "#8B93A1",
        "panel-graphite": "#111827",
        "deep-steel": "#1F2937",
      },
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
        accent: ["Archivo Black", "sans-serif"],
      },
      backgroundImage: {
        "grid-pattern":
          "linear-gradient(rgba(29,78,216,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(29,78,216,0.07) 1px, transparent 1px)",
      },
      backgroundSize: {
        "grid-size": "40px 40px",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.5s ease-in-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
