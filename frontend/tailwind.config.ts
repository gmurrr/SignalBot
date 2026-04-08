import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./types/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "#050505",
        foreground: "#f6f1e1",
        muted: "#8a826f",
        brass: "#D4AF37",
        panel: "#0d0d0d",
        line: "rgba(212, 175, 55, 0.16)"
      },
      boxShadow: {
        brass: "0 0 0 1px rgba(212,175,55,0.14), 0 18px 60px rgba(212,175,55,0.18)"
      },
      backgroundImage: {
        vellum:
          "radial-gradient(circle at top, rgba(212,175,55,0.16), transparent 28%), linear-gradient(180deg, rgba(255,255,255,0.03), transparent 30%), linear-gradient(135deg, rgba(212,175,55,0.08), transparent 45%)"
      }
    }
  },
  plugins: []
};

export default config;
