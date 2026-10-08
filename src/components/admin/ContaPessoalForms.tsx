"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { CONTROLE, Field, FieldRow, ROTULO } from "@/components/ui/Field";
import { FormFeedback } from "@/components/ui/FormFeedback";
import { criarContaPessoalAcao, registrarCompraPessoalAcao } from "@/lib/admin/acoes";
import { FORM_INICIAL } from "@/lib/forms";

/**
 * Os formulários da conta pessoal na tela da operadora: criar a conta e
 * registrar um pacote pago fora da plataforma.
 *
 * Até o cadastro self-service (A3) e o checkout (A4), é por aqui que o avulso
 * entra e recebe ficha — e depois continua sendo o caminho de reserva.
 */

export function NovaContaPessoalForm({ termoConta }: { termoConta: string }) {
  const [estado, acao, enviando] = useActionState(criarContaPessoalAcao, FORM_INICIAL);

  return (
    <form action={acao} className="flex flex-col gap-3.5">
      <FormFeedback erro={estado.erro} ok={estado.ok} credencial={estado.credencial} />

      <Field htmlFor="cp-nome" label="Nome">
        <input
          id="cp-nome"
          name="nome"
          required
          maxLength={160}
          disabled={enviando}
          className={CONTROLE}
          placeholder="Joana Ribeiro"
        />
      </Field>

      <Field
        htmlFor="cp-email"
        label="E-mail pessoal"
        hint="Quem também tem conta corporativa entra aqui com outro e-mail: são duas contas."
      >
        <input
          id="cp-email"
          name="email"
          type="email"
          required
          disabled={enviando}
          className={CONTROLE}
          placeholder="joana@gmail.com"
        />
      </Field>

      <FieldRow>
        <Field htmlFor="cp-telefone" label="Telefone">
          <input
            id="cp-telefone"
            name="telefone"
            type="tel"
            maxLength={40}
            disabled={enviando}
            className={CONTROLE}
            placeholder="(11) 98765-4321"
          />
        </Field>
        <Field htmlFor="cp-cargo" label="Cargo">
          <input
            id="cp-cargo"
            name="cargo"
            maxLength={120}
            disabled={enviando}
            className={CONTROLE}
            placeholder="Enfermeira"
          />
        </Field>
      </FieldRow>

      <Field htmlFor="cp-area" label="Área" hint="Opcional.">
        <input
          id="cp-area"
          name="area"
          maxLength={120}
          disabled={enviando}
          className={CONTROLE}
          placeholder="Saúde"
        />
      </Field>

      <Button type="submit" disabled={enviando}>
        {enviando ? "Criando…" : `Criar ${termoConta.toLowerCase()}`}
      </Button>

      <p className="text-[12px] leading-[1.45] text-stone">
        A conta nasce com carteira vazia e uma senha provisória que aparece uma vez só.
      </p>
    </form>
  );
}

/** O pacote já formatado pelo servidor: o cliente não formata dinheiro. */
export type OpcaoDePacote = {
  id: string;
  nome: string;
  fichas: string;
  preco: string;
  porFicha: string;
  parcelas: string;
};

export function RegistrarPacoteForm({
  userId,
  token,
  pacotes,
  validade,
  termoFichas,
}: {
  userId: string;
  token: string;
  pacotes: OpcaoDePacote[];
  termoFichas: string;
  /** "12 meses" — dito antes do clique, porque é o que a pessoa comprou. */
  validade: string;
}) {
  // Envio por `action`, de propósito: depois do registro o formulário volta
  // limpo. Mantido preenchido, um segundo clique registraria o mesmo pacote de
  // novo — com outro token, porque a página renderiza de novo e sorteia outro.
  const [estado, acao, enviando] = useActionState(registrarCompraPessoalAcao, FORM_INICIAL);

  if (pacotes.length === 0) {
    return (
      <p className="text-[13px] leading-[1.5] text-stone">
        Nenhum pacote ativo. A tabela de pacotes vive na configuração da plataforma.
      </p>
    );
  }

  return (
    <form action={acao} className="flex flex-col gap-3.5">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="token" value={token} />
      <FormFeedback erro={estado.erro} ok={estado.ok} credencial={estado.credencial} />

      <fieldset className="flex flex-col gap-2" disabled={enviando}>
        <legend className={ROTULO}>Pacote</legend>
        {pacotes.map((pacote) => {
          // Rádio não controlado: o reset do React 19 depois da ação desmarca
          // tudo de verdade, e a borda acompanha pelo `:checked`, sem estado que
          // possa discordar do DOM (a lição do "Dia inteiro" da F3).
          return (
            <label
              key={pacote.id}
              className="flex cursor-pointer items-center gap-3 rounded-[10px] border border-line2 bg-surface px-3 py-2.5 transition-colors hover:border-ghost has-[:checked]:border-accent has-[:checked]:bg-blush"
            >
              <input
                type="radio"
                name="pacote"
                value={pacote.id}
                required
                className="accent-accent"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold text-ink">
                  {pacote.nome}
                </span>
                <span className="block font-mono text-[11px] text-stone">
                  {pacote.fichas} · {pacote.porFicha} cada · {pacote.parcelas}
                </span>
              </span>
              <span className="font-mono text-[13px] font-semibold tabular-nums text-ink">
                {pacote.preco}
              </span>
            </label>
          );
        })}
      </fieldset>

      <Field htmlFor="cp-referencia" label="Referência do pagamento">
        <input
          id="cp-referencia"
          name="referencia"
          maxLength={160}
          disabled={enviando}
          className={CONTROLE}
          placeholder="Pix de 02/10 · comprovante 4821"
        />
      </Field>

      <Button type="submit" variant="gold" disabled={enviando}>
        {enviando ? "Registrando…" : "Registrar pacote pago"}
      </Button>

      <p className="text-[12px] leading-[1.45] text-stone">
        Para pagamento já recebido fora da plataforma. As {termoFichas} entram na carteira na
        hora e valem {validade} a partir de hoje. Não se edita depois: correção é lançamento novo.
      </p>
    </form>
  );
}
