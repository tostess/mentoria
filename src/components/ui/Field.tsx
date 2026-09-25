import type { ReactNode } from "react";

/**
 * Campos de formulário do sistema de design.
 *
 * As classes moram aqui como constantes exportadas porque três telas diferentes
 * precisam do mesmo controle e a alternativa — repetir a string de classes —
 * é como o foco de um input passa a ser magenta numa tela e cinza na outra.
 *
 * Componente de servidor: nada aqui depende do accent. O foco usa o magenta
 * default de propósito, porque a borda de foco é affordance de sistema, não
 * marca da empresa — e um accent claro demais apagaria o estado de foco.
 */

export const CONTROLE =
  "w-full rounded-[10px] border border-[#EAD6E1] bg-white px-3 py-2.5 text-[13.5px] text-[#2A1B26] outline-none transition-colors focus:border-[#C2317A] disabled:cursor-not-allowed disabled:bg-[#FDF8FB] disabled:text-[#8E7C86]";

export const CONTROLE_MONO = `${CONTROLE} font-mono tabular-nums`;

export const ROTULO =
  "mb-1.5 block font-mono text-[9.5px] uppercase tracking-[0.12em] text-[#8E7C86]";

type FieldProps = {
  /** Precisa casar com o `id` do controle — é o que liga rótulo e campo. */
  htmlFor: string;
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Field({ htmlFor, label, hint, children, className = "" }: FieldProps) {
  return (
    <div className={className}>
      <label className={ROTULO} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <p className="mt-[5px] text-[12px] leading-[1.45] text-[#8E7C86]">{hint}</p>}
    </div>
  );
}

/** Duas colunas que viram uma abaixo de 640px. */
export function FieldRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
}
