import { DEFAULT_APP_CONFIG } from '@/lib/config/defaults';

const b = DEFAULT_APP_CONFIG.branding;

/**
 * Casca de tela do scaffold: existe para a rota resolver e o guard de papel ser
 * testavel. Cada uma e substituida pela fase indicada em `phase`.
 */
export function PagePlaceholder({
  title,
  phase,
  description,
}: {
  title: string;
  phase: string;
  description: string;
}) {
  return (
    <section className="mx-auto max-w-2xl">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold" style={{ color: b.text }}>
          {title}
        </h1>
        <span
          className="rounded-full px-2 py-0.5 text-xs font-medium"
          style={{ backgroundColor: '#EEF2FF', color: b.primary }}
        >
          {phase}
        </span>
      </div>
      <p className="mt-2 text-sm" style={{ color: b.textMuted }}>
        {description}
      </p>
      <div
        className="mt-6 rounded-xl border border-dashed p-6 text-sm"
        style={{ borderColor: b.border, color: b.textMuted }}
      >
        Scaffold. Sem feature de negocio ainda.
      </div>
    </section>
  );
}
