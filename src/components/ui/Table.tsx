import type { ReactNode } from "react";

/**
 * Tabela do sistema de design.
 *
 * O `overflow-x` mora no invólucro e não na página: a lista de colaboradores
 * tem coluna de e-mail e a de Parceiros tem coluna de áreas, e num celular
 * qualquer uma das duas empurraria a tela inteira para o lado se a rolagem
 * fosse do corpo.
 */

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full border-collapse text-[13.5px]">{children}</table>
    </div>
  );
}

export function Th({
  children,
  align = "left",
  className = "",
}: {
  children?: ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={`whitespace-nowrap px-3 pb-[9px] font-mono text-[9.5px] font-medium uppercase tracking-[0.12em] text-stone ${
        align === "right" ? "text-right" : "text-left"
      } ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = "left",
  className = "",
}: {
  children?: ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <td
      className={`border-t border-line px-3 py-3 align-middle ${
        align === "right" ? "text-right" : ""
      } ${className}`}
    >
      {children}
    </td>
  );
}

/** Nome em destaque com um complemento abaixo — o par que toda linha usa. */
export function CellStack({ title, sub }: { title: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="truncate font-semibold">{title}</div>
      {sub && <div className="truncate text-[12px] text-stone">{sub}</div>}
    </div>
  );
}
