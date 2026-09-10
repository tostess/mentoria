import type { ReactNode } from "react";

export function Tag({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-[7px] bg-[#FDF8FB] px-[9px] py-[3px] text-[11.5px] text-[#6E5F68] ${className}`}
    >
      {children}
    </span>
  );
}
