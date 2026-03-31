import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        bg: "var(--bg)",
        card: "var(--card)",
        "card-muted": "var(--card-muted)",
        text: "var(--text)",
        "text-muted": "var(--text-muted)",
        border: "var(--border)",
        "input-bg": "var(--input-bg)",
        primary: "var(--primary)",
        success: "var(--success)",
        danger: "var(--danger)",
      },
    },
  },
  plugins: [],
} satisfies Config;
