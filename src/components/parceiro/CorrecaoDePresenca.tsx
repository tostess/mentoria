"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTerms } from "@/components/config/TermsProvider";
import { Button } from "@/components/ui/Button";

type Estado = { fase: "parado" } | { fase: "confirmando" } | { fase: "enviando" } | { fase: "erro"; texto: string };

/**
 * "A sala errou: a pessoa participou." Em dois passos, porque fica no histórico
 * da operadora e não tem volta pela tela. A frase diz o que muda e o que não
 * muda — a ficha já tinha sido usada nos dois casos.
 */
export function CorrecaoDePresenca({ bookingId, primeiroNome }: { bookingId: string; primeiroNome: string }) {
  const router = useRouter();
  const t = useTerms();
  const [estado, setEstado] = useState<Estado>({ fase: "parado" });

  async function corrigir() {
    setEstado({ fase: "enviando" });
    try {
      const r = await fetch(`/api/sessoes/${bookingId}/presenca`, { method: "POST" });
      if (r.ok) {
        router.refresh();
        return;
      }
      const c = (await r.json().catch(() => ({}))) as { erro?: string };
      setEstado({ fase: "erro", texto: c.erro ?? "Não foi possível corrigir agora." });
      if (r.status === 409 || r.status === 404) router.refresh();
    } catch {
      setEstado({ fase: "erro", texto: "Sem conexão. Tente de novo." });
    }
  }

  if (estado.fase === "confirmando" || estado.fase === "enviando") {
    return (
      <div className="flex max-w-[440px] flex-col gap-2.5 rounded-[12px] border border-line bg-mist px-3.5 py-3">
        <p className="text-[13px] leading-[1.45] text-ink">
          Marcar que {primeiroNome} participou? A {t.session} passa a contar como realizada. A{" "}
          {t.ficha} não muda — já tinha sido usada. Fica registrado no histórico da {t.admin.toLowerCase()}.
        </p>
        <div className="flex gap-2">
          <Button size="sm" disabled={estado.fase === "enviando"} onClick={() => void corrigir()}>
            {estado.fase === "enviando" ? "Corrigindo…" : "Participou"}
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
      <button
        type="button"
        onClick={() => setEstado({ fase: "confirmando" })}
        className="text-[12.5px] font-semibold text-accent hover:underline"
      >
        Participou, sim
      </button>
      {estado.fase === "erro" && (
        <span role="alert" className="text-[12px] text-danger">
          {estado.texto}
        </span>
      )}
    </>
  );
}
