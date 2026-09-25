import { ICONES, type NomeIcone } from "./icones";

/**
 * Ícone do sistema. Traço de 1.75 porque o lucide nasce com 2, e ao lado da
 * Instrument Sans em 13,5px o traço cheio pesa mais que a letra.
 *
 * Decorativo por padrão (`aria-hidden`): quase todo ícone aqui acompanha um
 * texto que já diz a mesma coisa, e leitor de tela lendo "lápis, Editar" é
 * ruído. Quando o ícone é a única coisa no botão, `label` dá nome a ele.
 */
export function Icone({
  nome,
  tamanho = 16,
  label,
  className = "",
}: {
  nome: NomeIcone;
  tamanho?: number;
  label?: string;
  className?: string;
}) {
  const Componente = ICONES[nome];
  return (
    <Componente
      size={tamanho}
      strokeWidth={1.75}
      className={`shrink-0 ${className}`}
      aria-hidden={label === undefined ? true : undefined}
      aria-label={label}
      role={label === undefined ? undefined : "img"}
    />
  );
}
