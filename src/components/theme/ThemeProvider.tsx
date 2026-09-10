"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_THEME, type Theme } from "@/lib/theme";

const ThemeContext = createContext<Theme>(DEFAULT_THEME);

export function ThemeProvider({ theme, children }: { theme: Theme; children: ReactNode }) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

/** Tema resolvido mais próximo. Fora de um provider, devolve o default da plataforma. */
export function useTheme(): Theme {
  return useContext(ThemeContext);
}
