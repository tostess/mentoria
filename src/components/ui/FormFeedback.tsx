import type { Credencial } from "@/lib/forms";

/**
 * O retorno de uma Server Action, na tela.
 *
 * Erro e sucesso são `role="alert"` e `aria-live` porque a tela não navega: o
 * formulário fica onde está e só o texto muda, e leitor de tela não tem como
 * perceber isso sozinho.
 */
export function FormFeedback({
  erro,
  ok,
  credencial,
}: {
  erro: string | null;
  ok: string | null;
  credencial: Credencial | null;
}) {
  if (erro === null && ok === null) return null;

  if (erro !== null) {
    return (
      <p
        role="alert"
        className="rounded-[10px] border border-[#F2CFC8] bg-[#FBEAE7] px-3 py-2.5 text-[13px] text-[#A63A2E]"
      >
        {erro}
      </p>
    );
  }

  return (
    <div aria-live="polite" className="flex flex-col gap-2.5">
      <p className="rounded-[10px] border border-[#CDE6DA] bg-[#EAF6F0] px-3 py-2.5 text-[13px] text-[#2E6B52]">
        {ok}
      </p>
      {credencial && <Acesso credencial={credencial} />}
    </div>
  );
}

/**
 * A senha provisória, mostrada uma vez.
 *
 * Fica em ouro suave e não em verde de sucesso porque o recado não é "deu
 * certo", é "isto não volta a aparecer". O banco guarda o hash: recarregar a
 * página perde o valor para sempre, e a única saída passa a ser redefinir.
 */
function Acesso({ credencial }: { credencial: Credencial }) {
  return (
    <div className="rounded-[12px] border border-[#EFD9A8] bg-[#FBF1DE] px-[15px] py-[13px]">
      <p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-[#8A5D0C]">
        Acesso provisório — copie agora
      </p>
      <dl className="mt-2.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
        <dt className="text-[#8A5D0C]">E-mail</dt>
        <dd className="select-all break-all font-mono text-[#7A5209]">{credencial.email}</dd>
        <dt className="text-[#8A5D0C]">Senha</dt>
        <dd className="select-all break-all font-mono font-semibold text-[#7A5209]">
          {credencial.senha}
        </dd>
      </dl>
      <p className="mt-2.5 text-[12px] leading-[1.45] text-[#8A5D0C]">
        Recarregar a página apaga esta senha. Se ela se perder, crie uma nova pelo painel do
        Supabase.
      </p>
    </div>
  );
}
