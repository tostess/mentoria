import type { HTMLAttributes, ReactNode } from "react";

type Props = HTMLAttributes<HTMLDivElement> & {
  title?: ReactNode;
  action?: ReactNode;
  /** Sem borda visível — para blocos dentro de outros cards. */
  flat?: boolean;
  children: ReactNode;
};

export function Card({ title, action, flat = false, className = "", children, ...rest }: Props) {
  const border = flat ? "border-transparent" : "border-[#F3E4EC]";
  return (
    <div className={`rounded-[14px] border bg-white p-5 ${border} ${className}`} {...rest}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3.5">
          {title ? <h3 className="text-[20px]">{title}</h3> : <span />}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
