import Link from "next/link";
import { Brand } from "@/components/shell/Brand";
import { Card } from "@/components/ui/Card";
import { SHELL_HOME, SHELL_LABEL, type Shell } from "@/lib/roles";

const SHELLS: Shell[] = ["professional", "partner", "org", "admin"];

/**
 * Índice temporário das cascas. Na Etapa 4 o middleware redireciona `/`
 * para a casca do papel logado e esta página deixa de existir.
 */
export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-10">
      <Brand sub="Etapa 1" />
      <Card className="w-full max-w-[400px]" title="Cascas">
        <ul className="flex flex-col gap-1">
          {SHELLS.map((shell) => (
            <li key={shell}>
              <Link
                href={SHELL_HOME[shell]}
                className="flex items-center justify-between rounded-[9px] px-2.5 py-[9px] text-[13.5px] hover:bg-[#FDF8FB]"
              >
                <span className="font-semibold">{SHELL_LABEL[shell]}</span>
                <span className="font-mono text-[10px] text-[#8E7C86]">{SHELL_HOME[shell]}</span>
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/entrar"
              className="flex items-center justify-between rounded-[9px] px-2.5 py-[9px] text-[13.5px] hover:bg-[#FDF8FB]"
            >
              <span className="font-semibold">Acesso</span>
              <span className="font-mono text-[10px] text-[#8E7C86]">/entrar</span>
            </Link>
          </li>
          {process.env.NODE_ENV !== "production" && (
            <li>
              <Link
                href="/design"
                className="flex items-center justify-between rounded-[9px] px-2.5 py-[9px] text-[13.5px] hover:bg-[#FDF8FB]"
              >
                <span className="font-semibold">Sistema de design</span>
                <span className="font-mono text-[10px] text-[#8E7C86]">/design · só dev</span>
              </Link>
            </li>
          )}
        </ul>
      </Card>
    </div>
  );
}
