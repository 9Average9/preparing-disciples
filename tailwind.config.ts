import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
    "./hooks/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "bg-base": "#0f1117",
        "bg-surface": "#161b27",
        "bg-elevated": "#1e2433",
        "border-subtle": "#2a3042",
        "text-primary": "#f0f2f5",
        "text-muted": "#8b92a5",
        accent: "#c9a84c",
        "accent-hover": "#e0bc6a",
        success: "#4caf7d",
        danger: "#e05c5c",
      },
      minWidth: {
        "1024": "1024px",
      },
    },
  },
  plugins: [],
};

export default config;
