"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icone } from "@/components/ui/Icone";

type Estado =
  | { fase: "parado" }
  | { fase: "confirmando-recusa" }
  | { fase: "enviando"; acao: "confirmar" | "recusar" }
  | { fase: "erro"; texto: string };

/**
 * Confirmar e recusar um pedido pendente.
 *
 * Recusar é em dois passos, como os destrutivos do admin: devolve a ficha a
 * quem pediu e reabre o horário, e não tem volta. Confirmar é um clique — o
 * pedido já ocupa o horário, confirmar só muda o nome.
 *
 * Depois de qualquer resposta a página é recarregada do servidor: a lista que
 * aparece é a que o banco tem, não a que o cliente imagina.
 */
export function RespostaAoPedido({
  bookingId,
  primeiroNome,
  prazo,
  urgente,
  termoFicha,
}: {
  bookingId: string;
  primeiroNome: string;
  /** "expira em 41 h", já calculado no servidor. */
  prazo: string;
  /** Menos de 12 h: o prazo aparece em ouro, sem animação. */
  urgente: boolean;
  termoFicha: string;
}) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({ fase: "parado" });

  async function responder(acao: "confirmar" | "recusar") {
    setEstado({ fase: "enviando", acao });
    try {
      const resposta = await fetch(`/api/bookings/${bookingId}/${acao}`, { method: "POST" });
      if (resposta.ok) {
        router.refresh();
        return;
      }
      const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string };
      setEstado({ fase: "erro", texto: corpo.erro ?? "Não foi possível responder agora." });
      // Já respondido ou expirado: a lista do servidor mostra o estado real.
      if (resposta.status === 409 || resposta.status === 404) router.refresh();
    } catch {
      setEstado({ fase: "erro", texto: "Sem conexão. Tente de novo." });
    }
  }

  if (estado.fase === "confirmando-recusa") {
    return (
      <div className="flex max-w-[320px] flex-col gap-2.5 rounded-[12px] bg-danger-soft px-3.5 py-3">
        <p className="text-[13px] text-danger">
          Recusar o pedido de {primeiroNome}? A {termoFicha} volta para {primeiroNome} agora e o
          horário reabre na sua agenda.
        </p>
        <div className="flex gap-2">
          <Button variant="warn" size="sm" onClick={() => responder("recusar")}>
            Recusar pedido
          </Button>
          <Button
            variant="ghost"
            size="sm"
            autoFocus
            onClick={() => setEstado({ fase: "parado" })}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEstado({ fase: "parado" });
            }}
          >
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  const enviando = estado.fase === "enviando";
  return (
    <>
      <div className="flex gap-[7px]">
        <Button
          variant="ghost"
          size="sm"
          disabled={enviando}
          onClick={() => setEstado({ fase: "confirmando-recusa" })}
        >
          {enviando && estado.acao === "recusar" ? "Recusando…" : "Recusar"}
        </Button>
        <Button size="sm" disabled={enviando} onClick={() => responder("confirmar")}>
          <Icone nome="check" tamanho={13} />
          {enviando && estado.acao === "confirmar" ? "Confirmando…" : "Confirmar"}
        </Button>
      </div>
      <span className={`font-mono text-[10.5px] ${urgente ? "text-gold-text" : "text-stone"}`}>
        {prazo}
      </span>
      {estado.fase === "erro" && (
        <span role="alert" className="max-w-[260px] text-right text-[12px] text-danger">
          {estado.texto}
        </span>
      )}
    </>
  );
}
