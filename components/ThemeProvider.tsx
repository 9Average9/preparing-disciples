"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Theme = "parchment" | "midnight" | "forest" | "royal" | "dawn";

export const THEMES: {
  id: Theme;
  name: string;
  description: string;
  light: boolean;
  preview: { base: string; surface: string; accent: string; border: string };
}[] = [
  {
    id: "parchment",
    name: "Parchment",
    description: "Warm cream — calm & welcoming",
    light: true,
    preview: {
      base: "#f5f2ec",
      surface: "#ffffff",
      accent: "#b8903f",
      border: "#ddd7cc",
    },
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Deep dark blue — focused",
    light: false,
    preview: {
      base: "#0a0d14",
      surface: "#111520",
      accent: "#c9a84c",
      border: "#232838",
    },
  },
  {
    id: "forest",
    name: "Forest",
    description: "Sage green — fresh & natural",
    light: true,
    preview: {
      base: "#eef5ec",
      surface: "#ffffff",
      accent: "#4a7c4e",
      border: "#cddbc9",
    },
  },
  {
    id: "royal",
    name: "Royal",
    description: "Deep indigo — regal & refined",
    light: false,
    preview: {
      base: "#0c0a18",
      surface: "#120f24",
      accent: "#9b7fe8",
      border: "#262040",
    },
  },
  {
    id: "dawn",
    name: "Dawn",
    description: "Warm blush — soft & inviting",
    light: true,
    preview: {
      base: "#fdf7f5",
      surface: "#ffffff",
      accent: "#b05a50",
      border: "#ead4ce",
    },
  },
];

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "parchment",
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("parchment");

  useEffect(() => {
    const saved = localStorage.getItem("pd-theme") as Theme | null;
    if (saved && THEMES.some((t) => t.id === saved)) {
      setThemeState(saved);
    }
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    if (theme === "parchment") {
      html.removeAttribute("data-theme");
    } else {
      html.setAttribute("data-theme", theme);
    }
    localStorage.setItem("pd-theme", theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeState }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
