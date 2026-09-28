import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Icone } from "@/components/ui/Icone";
import type { SessaoNaAgenda } from "@/lib/bookings/agenda";
import { hora } from "@/lib/formato";
import { porta } from "@/lib/video/sala";

const UM_DIA = 24 * 3_600_000;

/**
 * O botão da sala, só quando ela está aberta — dez minutos antes até cinco
 * depois do fim. A mesma regra que a rota de entrada confere (`porta`), então a
 * agenda nunca oferece uma porta que o servidor fecharia.
 *
 * Função e não componente: quem chama precisa saber se há botão, para pôr o
 * selo de status no lugar quando não houver.
 */
export function botaoDaSala(sessao: SessaoNaAgenda, agora: Date): ReactNode | undefined {
  if (!porta(sessao, agora).aberta) return undefined;
  return (
    <ButtonLink href={`/sala/${sessao.id}`} size="sm">
      <Icone nome="video" tamanho={14} />
      Entrar na sala
    </ButtonLink>
  );
}

/**
 * "A sala abre às 08:50", para sessão confirmada das próximas 24 horas que
 * ainda não abriu. Mais longe que isso a frase só ocupa espaço.
 */
export function quandoAbreASala(sessao: SessaoNaAgenda, agora: Date, fuso: string): string | undefined {
  const agoraNaSala = porta(sessao, agora);
  if (agoraNaSala.aberta || agoraNaSala.motivo !== "cedo") return undefined;
  if (agoraNaSala.janela.abre.getTime() - agora.getTime() > UM_DIA) return undefined;
  return `A sala abre às ${hora(agoraNaSala.janela.abre, fuso)}.`;
}
