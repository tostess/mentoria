import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const field =
  "w-full rounded-[10px] border border-[#EAD6E1] bg-white px-3 py-2.5 text-[13.5px] text-[#2A1B26] disabled:bg-[#FDF8FB]";
const label = "mb-1.5 block font-mono text-[9.5px] uppercase tracking-[0.12em] text-[#8E7C86]";

/** Só casca. O login de verdade chega na Etapa 4. */
export default function EntrarPage() {
  return (
    <Card>
      <h1 className="text-[33px]">Entrar</h1>
      <p className="mb-5 mt-1 text-[13px] text-[#8E7C86]">Use o e-mail cadastrado pela sua empresa.</p>
      <form className="flex flex-col gap-4">
        <div>
          <label className={label} htmlFor="email">
            E-mail
          </label>
          <input id="email" type="email" className={field} disabled placeholder="voce@empresa.com.br" />
        </div>
        <div>
          <label className={label} htmlFor="password">
            Senha
          </label>
          <input id="password" type="password" className={field} disabled placeholder="••••••••" />
        </div>
        <Button type="button" disabled>
          Entrar
        </Button>
        <Button type="button" variant="ghost" disabled>
          Entrar com Google
        </Button>
      </form>
    </Card>
  );
}
