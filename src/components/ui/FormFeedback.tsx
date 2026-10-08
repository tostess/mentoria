import type { Credencial } from "@/lib/forms";
import { BotaoCopiar } from "./BotaoCopiar";
import { Icone } from "./Icone";

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
        className="flex items-start gap-2 rounded-[10px] border border-danger-line bg-danger-soft px-3 py-2.5 text-[13px] text-danger"
      >
        <Icone nome="x" tamanho={15} className="mt-px" />
        {erro}
      </p>
    );
  }

  return (
    <div aria-live="polite" className="flex flex-col gap-2.5">
      <p className="flex items-start gap-2 rounded-[10px] border border-success-line bg-success-soft px-3 py-2.5 text-[13px] text-success">
        <Icone nome="check" tamanho={15} className="mt-px" />
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
    <div className="rounded-[12px] border border-gold-line bg-gold-soft px-[15px] py-[13px]">
      <p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-gold-text">
        Acesso provisório — copie agora
      </p>
      <dl className="mt-2.5 grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1.5 text-[13px]">
        <dt className="text-gold-text">E-mail</dt>
        <dd className="select-all break-all font-mono text-gold-ink">{credencial.email}</dd>
        <BotaoCopiar valor={credencial.email} rotulo="e-mail" />
        <dt className="text-gold-text">Senha</dt>
        <dd className="select-all break-all font-mono font-semibold text-gold-ink">
          {credencial.senha}
        </dd>
        <BotaoCopiar valor={credencial.senha} rotulo="senha" />
      </dl>
      <p className="mt-2.5 text-[12px] leading-[1.45] text-gold-text">
        Recarregar a página apaga esta senha. Se ela se perder, gere outra na página da pessoa.
      </p>
    </div>
  );
}
