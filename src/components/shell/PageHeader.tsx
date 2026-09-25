import type { ReactNode } from "react";

type Props = {
  /** `ReactNode` e não `string`: a trilha de migalhas entra por aqui, com link. */
  eyebrow?: ReactNode;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** À esquerda do título — o avatar numa tela de pessoa. */
  lead?: ReactNode;
};

export function PageHeader({ eyebrow, title, description, actions, lead }: Props) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
      <div className="flex min-w-0 items-center gap-4">
        {lead}
        <div className="min-w-0">
          {/* `div` e não `span`: a trilha de migalhas é um `nav` com lista. */}
          {eyebrow && (
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#8E7C86]">
              {eyebrow}
            </div>
          )}
          <h1 className="text-[33px] lg:text-[40px]">{title}</h1>
          {description && (
            <p className="mt-[7px] max-w-[60ch] text-[14px] text-[#8E7C86]">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-[11px]">{actions}</div>}
    </div>
  );
}
