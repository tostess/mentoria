import type { HTMLAttributes, ReactNode } from "react";
import { Icone } from "./Icone";
import type { NomeIcone } from "./icones";

type Props = Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  title?: ReactNode;
  /** Ícone antes do título, em pedra — o título continua sendo o que se lê. */
  icone?: NomeIcone;
  action?: ReactNode;
  /** Sem borda visível — para blocos dentro de outros cards. */
  flat?: boolean;
  children: ReactNode;
};

export function Card({
  title,
  icone,
  action,
  flat = false,
  className = "",
  children,
  ...rest
}: Props) {
  const border = flat ? "border-transparent" : "border-[#F3E4EC]";
  return (
    <div className={`rounded-[14px] border bg-white p-5 ${border} ${className}`} {...rest}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3.5">
          {title ? (
            <h3 className="flex items-center gap-2 text-[20px]">
              {icone && <Icone nome={icone} tamanho={17} className="text-[#8E7C86]" />}
              {title}
            </h3>
          ) : (
            <span />
          )}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
