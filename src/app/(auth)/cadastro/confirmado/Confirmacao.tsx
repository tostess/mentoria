"use client";

import { useEffect, useRef, useState } from "react";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Icone } from "@/components/ui/Icone";
import { ReenviarForm } from "../ReenviarForm";

type Estado = "lendo" | "confirmado" | "falhou";

/**
 * Lê o fragmento que o servidor de auth deixou no endereço e o apaga.
 *
 * Num link que deu certo, o fragmento traz tokens de uma sessão sem papel —
 * ninguém os usa, e ficar com eles na barra (e no histórico) seria deixar
 * credencial à vista. Num que falhou, traz `error_code`.
 */
export function Confirmacao({ erroNaQuery, termoAdmin }: { erroNaQuery: boolean; termoAdmin: string }) {
  const [estado, setEstado] = useState<Estado>(erroNaQuery ? "falhou" : "lendo");
  /**
   * O veredito da primeira leitura. Apagar o fragmento faz uma segunda leitura
   * achar o endereço limpo e concluir "deu certo" — e o efeito roda duas vezes
   * no modo estrito do React (achado no `next dev`: o link vencido aparecia
   * como confirmado).
   */
  const veredito = useRef<Estado | null>(null);

  useEffect(() => {
    if (veredito.current === null) {
      const fragmento = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const falhou = erroNaQuery || fragmento.has("error_code") || fragmento.has("error");
      veredito.current = falhou ? "falhou" : "confirmado";
      if (window.location.hash !== "" || window.location.search !== "") {
        window.history.replaceState(null, "", window.location.pathname);
      }
    }
    // Sincroniza com o endereço, que só existe no navegador.
    setEstado(veredito.current);
  }, [erroNaQuery]);

  if (estado === "lendo") {
    return <div className="h-[180px]" aria-busy="true" />;
  }

  if (estado === "falhou") {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-[29px]">Este link não vale mais</h1>
          <p className="mt-1 text-[13px] leading-[1.5] text-ink">
            O link de confirmação expira e só pode ser usado uma vez. Se você já confirmou, é só
            esperar a análise do pedido. Se não, peça outro link:
          </p>
        </div>
        <ReenviarForm email={null} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <Icone nome="check" tamanho={20} className="mt-1.5 shrink-0 text-success" />
        <div>
          <h1 className="text-[29px]">E-mail confirmado</h1>
          <p className="mt-1 text-[13px] leading-[1.5] text-ink">
            Seu pedido foi para a {termoAdmin.toLowerCase()}, que confere cada cadastro antes de abrir
            a conta. Quando for aprovado, você entra com este e-mail e a senha que criou.
          </p>
        </div>
      </div>
      <ButtonLink href="/entrar" variant="ghost">
        Ir para a entrada
      </ButtonLink>
    </div>
  );
}
