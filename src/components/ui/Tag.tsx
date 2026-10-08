import type { ReactNode } from "react";

export function Tag({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-[7px] bg-mist px-[9px] py-[3px] text-[11.5px] text-stone-dark ${className}`}
    >
      {children}
    </span>
  );
}
