import { Icone } from "@/components/ui/Icone";
import { descrever, type Tom } from "@/lib/admin/atividade";
import type { AcaoRegistrada } from "@/lib/admin/consultas";
import { dataHora, quandoRelativo } from "@/lib/formato";
import type { Terms } from "@/lib/terms";

/**
 * O histórico de decisões como frase: ícone, quem fez o quê com quem, e
 * quando. Antes era o código de `audit_logs.action` em mono cru.
 *
 * O tempo relativo é calculado no servidor, na hora da requisição — o layout
 * raiz é `force-dynamic`, então "há 3 min" é de agora e não do build. A data
 * completa fica no `title` para quem precisa do instante exato.
 *
 * O círculo do ícone usa a paleta fixa, não o accent da empresa: esta tela é
 * da operadora, e o ouro é de ficha (compra e alocação).
 */

const TONS: Record<Tom, string> = {
  accent: "bg-blush text-deep",
  gold: "bg-gold-soft text-gold",
  neutral: "bg-mist text-stone",
  bad: "bg-danger-soft text-danger",
};

export function FeedDeAtividade({
  eventos,
  t,
  agora = new Date(),
}: {
  eventos: AcaoRegistrada[];
  t: Terms;
  agora?: Date;
}) {
  return (
    <ul className="flex flex-col">
      {eventos.map((evento) => {
        const { icone, tom, partes } = descrever(evento, t);
        return (
          <li
            key={evento.id}
            className="grid grid-cols-[32px_1fr] gap-3 border-t border-line py-[11px] first:border-t-0 first:pt-0 last:pb-0"
          >
            <span className={`grid h-8 w-8 place-items-center rounded-full ${TONS[tom]}`}>
              <Icone nome={icone} tamanho={15} />
            </span>
            <div className="min-w-0">
              <p className="text-[13.5px] leading-[1.45] text-ink">
                {partes.map((parte, i) =>
                  parte.forte ? (
                    <strong key={i} className="font-semibold">
                      {parte.texto}
                    </strong>
                  ) : (
                    <span key={i}>{parte.texto}</span>
                  ),
                )}
              </p>
              <time
                dateTime={evento.quando.toISOString()}
                title={dataHora(evento.quando)}
                className="mt-0.5 block font-mono text-[10.5px] text-stone"
              >
                {quandoRelativo(evento.quando, agora)}
              </time>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
