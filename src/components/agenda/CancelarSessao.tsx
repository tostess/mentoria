"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

type Estado = { fase: "parado" } | { fase: "confirmando" } | { fase: "enviando" } | { fase: "erro"; texto: string };

/**
 * "Cancelar", em dois passos, dos dois lados da sessão (F7).
 *
 * As frases chegam prontas do servidor, calculadas pela mesma regra que a
 * transação roda (`regraDoCancelamento`), e `esperado` volta no corpo: se o
 * prazo virou entre a página abrir e o clique, o servidor recusa em vez de mover
 * a ficha de um jeito que a pessoa não leu. A página recarrega e a frase nova
 * aparece.
 *
 * Fica na coluna do meio da linha, embaixo do horário, pelo mesmo motivo da
 * correção de presença: a confirmação aberta precisa de largura para ser lida.
 */
export function CancelarSessao({
  bookingId,
  pergunta,
  confirmar,
  prazo,
  esperado,
}: {
  bookingId: string;
  /** O que acontece com a ficha e com o horário, com o nome de quem está do outro lado. */
  pergunta: string;
  /** Texto do botão que confirma. */
  confirmar: string;
  /** "com a ficha de volta até 28/09, 21:00" — ao lado do link, antes do clique. */
  prazo?: string;
  esperado: { estorna: boolean; compensa: boolean };
}) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({ fase: "parado" });

  async function cancelar() {
    setEstado({ fase: "enviando" });
    try {
      const r = await fetch(`/api/bookings/${bookingId}/cancelar`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(esperado),
      });
      if (r.ok) {
        router.refresh();
        return;
      }
      const c = (await r.json().catch(() => ({}))) as { erro?: string };
      setEstado({ fase: "erro", texto: c.erro ?? "Não foi possível cancelar agora." });
      // Prazo virou, sala abriu ou já cancelada: a lista do servidor mostra o estado real.
      if (r.status === 409 || r.status === 404) router.refresh();
    } catch {
      setEstado({ fase: "erro", texto: "Sem conexão. Tente de novo." });
    }
  }

  if (estado.fase === "confirmando" || estado.fase === "enviando") {
    return (
      <div className="mt-1 flex max-w-[440px] flex-col gap-2.5 rounded-[12px] bg-danger-soft px-3.5 py-3">
        <p className="text-[13px] leading-[1.45] text-danger">{pergunta}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="warn" size="sm" disabled={estado.fase === "enviando"} onClick={() => void cancelar()}>
            {estado.fase === "enviando" ? "Cancelando…" : confirmar}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            autoFocus
            disabled={estado.fase === "enviando"}
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

  return (
    <>
      <span className="flex flex-wrap items-baseline gap-x-1.5">
        <button
          type="button"
          onClick={() => setEstado({ fase: "confirmando" })}
          className="text-[12.5px] font-semibold text-stone hover:text-danger hover:underline"
        >
          Cancelar
        </button>
        {prazo && <span className="text-[12px] text-stone">· {prazo}</span>}
      </span>
      {estado.fase === "erro" && (
        <span role="alert" className="block text-[12px] text-danger">
          {estado.texto}
        </span>
      )}
    </>
  );
}
