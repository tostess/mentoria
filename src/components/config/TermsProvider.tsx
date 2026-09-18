"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_TERMS, type Terms } from "@/lib/terms";

const TermsContext = createContext<Terms>(DEFAULT_TERMS);

/**
 * Vocabulário resolvido para os componentes de cliente. Mesmo desenho do
 * `ThemeProvider`: o servidor resolve uma vez, por requisição, e o cliente
 * consome — nenhum componente lê `app_config` por conta própria.
 */
export function TermsProvider({ terms, children }: { terms: Terms; children: ReactNode }) {
  return <TermsContext.Provider value={terms}>{children}</TermsContext.Provider>;
}

/** Termos mais próximos. Fora de um provider, o default da plataforma. */
export function useTerms(): Terms {
  return useContext(TermsContext);
}
