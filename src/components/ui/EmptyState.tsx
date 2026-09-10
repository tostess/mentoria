import type { ReactNode } from "react";

type Props = {
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ title, description, action, className = "" }: Props) {
  return (
    <div
      className={`rounded-[14px] border border-dashed border-[#EAD6E1] px-6 py-7 text-center text-[13px] text-[#8E7C86] ${className}`}
    >
      {title && <div className="mb-1 text-[15px] font-semibold text-[#2A1B26]">{title}</div>}
      {description && <div>{description}</div>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
