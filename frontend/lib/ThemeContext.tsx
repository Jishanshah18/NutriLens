import React, { createContext, useContext, useState, useEffect } from "react";

export interface ThemeColors {
  bg: string;
  card: string;
  cardAlt: string;
  border: string;
  text: string;
  textMuted: string;
  textDim: string;
  emerald: string;
  emeraldLight: string;
  crimson: string;
  amber: string;
  blue: string;
}

interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
  colors: ThemeColors;
}

const darkColors: ThemeColors = {
  bg: "#0B0F19",
  card: "#131B2E",
  cardAlt: "#1A243B",
  border: "#232F4A",
  text: "#F1F5F9",
  textMuted: "#94A3B8",
  textDim: "#64748B",
  emerald: "#10B981",
  emeraldLight: "#34D399",
  crimson: "#EF4444",
  amber: "#F59E0B",
  blue: "#3B82F6"
};

const lightColors: ThemeColors = {
  bg: "#F8FAFC",
  card: "#FFFFFF",
  cardAlt: "#F1F5F9",
  border: "#E2E8F0",
  text: "#0F172A",
  textMuted: "#475569",
  textDim: "#94A3B8",
  emerald: "#059669",
  emeraldLight: "#10B981",
  crimson: "#DC2626",
  amber: "#D97706",
  blue: "#2563EB"
};

const ThemeContext = createContext<ThemeContextType>({
  isDark: true,
  toggleTheme: () => {},
  colors: darkColors
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDark, setIsDark] = useState<boolean>(true);

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const saved = window.localStorage.getItem("nutrilens_theme");
        if (saved !== null) {
          setIsDark(saved === "dark");
        }
      }
    } catch (e) {}
  }, []);

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem("nutrilens_theme", next ? "dark" : "light");
        }
      } catch (e) {}
      return next;
    });
  };

  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
