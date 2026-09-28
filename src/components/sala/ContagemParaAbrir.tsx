"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { mmss } from "@/lib/video/relogio";

/**
 * Quanto falta para a sala abrir. Quando chega a zero, a página pede de novo ao
 * servidor — que decide se abriu —, em vez de o cliente abrir por conta própria.
 * Não é animação: só o número mudando.
 */
export function ContagemParaAbrir({ abreIso, agoraIso }: { abreIso: string; agoraIso: string }) {
  const router = useRouter();
  const abre = Date.parse(abreIso);
  const [agora, setAgora] = useState(() => Date.parse(agoraIso));

  useEffect(() => {
    const deslocamento = Date.parse(agoraIso) - Date.now();
    const id = setInterval(() => setAgora(Date.now() + deslocamento), 1000);
    return () => clearInterval(id);
  }, [agoraIso]);

  const falta = Math.max(0, Math.ceil((abre - agora) / 1000));
  useEffect(() => {
    if (falta === 0) router.refresh();
  }, [falta, router]);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="font-mono text-[44px] font-medium leading-none tabular-nums">{mmss(falta)}</div>
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#8E7C86]">até abrir</span>
    </div>
  );
}
