import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-syne)", "sans-serif"],
        body: ["var(--font-dm-sans)", "sans-serif"]
      },
      colors: {
        bg: "var(--bg)",
        "bg-soft": "var(--bg-soft)",
        panel: "var(--panel)",
        "panel-2": "var(--panel-2)",
        text: "var(--text)",
        muted: "var(--muted)",
        accent: "var(--accent)",
        "accent-glow": "var(--accent-glow)",
        danger: "var(--danger)",
        success: "var(--success)"
      },
      boxShadow: {
        panel: "0 20px 60px rgba(4, 10, 28, 0.45)",
        glow: "0 0 20px rgba(94, 186, 255, 0.3)",
        "glow-sm": "0 0 10px rgba(94, 186, 255, 0.2)"
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" }
        },
        "toast-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        "toast-out": {
          "0%": { opacity: "1", transform: "translateY(0)" },
          "100%": { opacity: "0", transform: "translateY(10px)" }
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 10px rgba(94, 186, 255, 0.3)" },
          "50%": { boxShadow: "0 0 20px rgba(94, 186, 255, 0.5)" }
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" }
        }
      },
      animation: {
        "fade-in-up": "fade-in-up 320ms cubic-bezier(0.16, 1, 0.3, 1)",
        "fade-in": "fade-in 260ms ease-out",
        "toast-in": "toast-in 230ms ease-out",
        "toast-out": "toast-out 210ms ease-in forwards",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite"
      },
      backgroundImage: {
        shimmer: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)"
      }
    }
  },
  plugins: []
};

export default config;
