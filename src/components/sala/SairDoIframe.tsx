"use client";

import { useEffect } from "react";

/**
 * Quem clica em sair no Prebuilt é levado pelo Daily para a tela de fim, mas
 * **dentro do iframe** (`redirect_on_meeting_exit`, medido no spike §6). Esta
 * página, carregada ali, sobe para a janela de cima — que é do mesmo domínio, e
 * por isso pode.
 */
export function SairDoIframe() {
  useEffect(() => {
    if (window.top !== null && window.top !== window.self) {
      window.top.location.replace(window.location.pathname);
    }
  }, []);
  return null;
}
