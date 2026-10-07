import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { loadTheme } from "@/lib/config/load";
import { RecuperarForm } from "./RecuperarForm";

export const metadata: Metadata = { title: "Esqueceu a senha" };

/**
 * "Esqueceu a senha?" — pede o link por e-mail. Serve a todos os papéis, e
 * também a quem recebeu senha provisória e a perdeu antes de trocar.
 */
export default async function Page() {
  const { accent } = await loadTheme(null);

  return (
    <div className="flex w-full max-w-[400px] flex-col gap-4">
      <Card>
        <h1 className="text-[33px]">Esqueceu a senha?</h1>
        <p className="mb-5 mt-1 text-[13px] leading-[1.5] text-[#8E7C86]">
          Digite o e-mail da sua conta. Mandamos um link para você criar uma senha nova.
        </p>
        <RecuperarForm />
      </Card>
      <p className="text-center text-[13px] text-[#8E7C86]">
        Lembrou?{" "}
        <Link href="/entrar" className="font-semibold hover:underline" style={{ color: accent }}>
          Entrar
        </Link>
      </p>
    </div>
  );
}
