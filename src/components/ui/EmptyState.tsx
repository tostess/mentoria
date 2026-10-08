import type { ReactNode } from "react";
import { Icone } from "./Icone";
import type { NomeIcone } from "./icones";

type Props = {
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
  icone?: NomeIcone;
  className?: string;
};

export function EmptyState({ title, description, action, icone, className = "" }: Props) {
  return (
    <div
      className={`rounded-[14px] border border-dashed border-line2 px-6 py-7 text-center text-[13px] text-stone ${className}`}
    >
      {icone && (
        <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-mist text-pale">
          <Icone nome={icone} tamanho={20} />
        </div>
      )}
      {title && <div className="mb-1 text-[15px] font-semibold text-ink">{title}</div>}
      {description && <div>{description}</div>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
