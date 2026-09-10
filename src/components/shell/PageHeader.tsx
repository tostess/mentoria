import type { ReactNode } from "react";

type Props = {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({ eyebrow, title, description, actions }: Props) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
      <div>
        {eyebrow && (
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#8E7C86]">
            {eyebrow}
          </span>
        )}
        <h1 className="text-[33px] lg:text-[40px]">{title}</h1>
        {description && (
          <p className="mt-[7px] max-w-[60ch] text-[14px] text-[#8E7C86]">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-[11px]">{actions}</div>}
    </div>
  );
}
