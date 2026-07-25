'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';
import { DEFAULT_APP_CONFIG } from '@/lib/config/defaults';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

/**
 * Botao base no estilo shadcn/ui, porem com cor em hex inline — sem CSS
 * variables (CLAUDE.md). Enquanto nao ha provider de branding, o default vem de
 * `DEFAULT_APP_CONFIG.branding`; telas reais devem passar o hex de
 * `appConfig.branding` via `style`.
 */
const b = DEFAULT_APP_CONFIG.branding;

const VARIANT_STYLE: Record<Variant, React.CSSProperties> = {
  primary: { backgroundColor: b.primary, color: b.primaryContrast, borderColor: b.primary },
  secondary: { backgroundColor: b.surface, color: b.text, borderColor: b.border },
  ghost: { backgroundColor: 'transparent', color: b.textMuted, borderColor: 'transparent' },
  danger: { backgroundColor: b.danger, color: '#FFFFFF', borderColor: b.danger },
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', style, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg border font-medium transition-opacity',
        'disabled:cursor-not-allowed disabled:opacity-50 hover:opacity-90',
        size === 'sm' ? 'h-8 px-3 text-sm' : 'h-10 px-4 text-sm',
        className,
      )}
      style={{ ...VARIANT_STYLE[variant], ...style }}
      {...props}
    />
  );
});
