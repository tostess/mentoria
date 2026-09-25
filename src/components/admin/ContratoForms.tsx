"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { CONTROLE, CONTROLE_MONO, Field } from "@/components/ui/Field";
import { FormFeedback } from "@/components/ui/FormFeedback";
import {
  alocarFichasAcao,
  criarProfissionalAcao,
  registrarContratoAcao,
} from "@/lib/admin/acoes";
import { FORM_INICIAL } from "@/lib/forms";

/**
 * Os três formulários da tela de uma empresa.
 *
 * Os dois que mexem em ficha carregam um `token` sorteado quando a página foi
 * montada (invariante 16). Reenviar o mesmo formulário colide na
 * `idempotency_key` e o banco recusa; abrir a tela de novo sorteia outro token
 * e a segunda compra legítima passa. É por isso que o token vem por prop do
 * servidor e não é gerado aqui: gerado no cliente, cada clique teria o seu, e
 * a proteção contra clique duplo deixaria de existir.
 */

type ComToken = { orgId: string; token: string };

export function RegistrarContratoForm({ orgId, token }: ComToken) {
  const [estado, acao, enviando] = useActionState(registrarContratoAcao, FORM_INICIAL);

  return (
    <form action={acao} className="flex flex-col gap-3.5">
      <input type="hidden" name="orgId" value={orgId} />
      <input type="hidden" name="token" value={token} />
      <FormFeedback erro={estado.erro} ok={estado.ok} credencial={estado.credencial} />

      <Field htmlFor="fichas" label="Fichas compradas">
        <input
          id="fichas"
          name="fichas"
          type="number"
          min={1}
          max={100000}
          required
          disabled={enviando}
          className={CONTROLE_MONO}
          placeholder="120"
        />
      </Field>

      <Field htmlFor="referencia" label="Referência">
        <input
          id="referencia"
          name="referencia"
          maxLength={160}
          disabled={enviando}
          className={CONTROLE}
          placeholder="Contrato anual 2026/2027"
        />
      </Field>

      <Button type="submit" variant="gold" disabled={enviando}>
        {enviando ? "Registrando…" : "Registrar compra"}
      </Button>

      <p className="text-[12px] leading-[1.45] text-[#8E7C86]">
        Entra como compra no livro-caixa da empresa e soma no saldo do contrato. Não se edita
        depois: correção é lançamento novo.
      </p>
    </form>
  );
}

export type OpcaoDeColaborador = { id: string; nome: string; saldo: number };

export function AlocarFichasForm({
  orgId,
  token,
  colaboradores,
  teto,
  termoFichas,
  selecionado,
}: ComToken & {
  colaboradores: OpcaoDeColaborador[];
  teto: number;
  termoFichas: string;
  /** Quem já vem escolhido — o atalho "Alocar" da tela da pessoa manda `?para=`. */
  selecionado?: string;
}) {
  const [estado, acao, enviando] = useActionState(alocarFichasAcao, FORM_INICIAL);

  if (colaboradores.length === 0) {
    return (
      <p className="text-[13px] leading-[1.5] text-[#8E7C86]">
        Crie um colaborador primeiro. A ficha sai do contrato e entra na carteira de alguém — sem
        carteira, não há para onde ir.
      </p>
    );
  }

  return (
    <form action={acao} className="flex flex-col gap-3.5">
      <input type="hidden" name="orgId" value={orgId} />
      <input type="hidden" name="token" value={token} />
      <FormFeedback erro={estado.erro} ok={estado.ok} credencial={estado.credencial} />

      <Field htmlFor="userId" label="Colaborador">
        <select
          id="userId"
          name="userId"
          required
          defaultValue={selecionado}
          disabled={enviando}
          className={CONTROLE}
        >
          {colaboradores.map((pessoa) => (
            <option key={pessoa.id} value={pessoa.id}>
              {pessoa.nome} — {pessoa.saldo === 0 ? `sem ${termoFichas}` : `${pessoa.saldo}`}
            </option>
          ))}
        </select>
      </Field>

      <Field
        htmlFor="quantidade"
        label="Quantas"
        hint={`Teto de ${teto} por carteira. As ${termoFichas} acumulam e não expiram.`}
      >
        <input
          id="quantidade"
          name="quantidade"
          type="number"
          min={1}
          max={teto}
          defaultValue={2}
          required
          disabled={enviando}
          className={CONTROLE_MONO}
        />
      </Field>

      <Button type="submit" disabled={enviando}>
        {enviando ? "Alocando…" : "Alocar"}
      </Button>
    </form>
  );
}

export function NovoProfissionalForm({
  orgId,
  termoProfissional,
}: {
  orgId: string;
  termoProfissional: string;
}) {
  const [estado, acao, enviando] = useActionState(criarProfissionalAcao, FORM_INICIAL);

  return (
    <form action={acao} className="flex flex-col gap-3.5">
      <input type="hidden" name="orgId" value={orgId} />
      <FormFeedback erro={estado.erro} ok={estado.ok} credencial={estado.credencial} />

      <Field htmlFor="p-nome" label="Nome">
        <input
          id="p-nome"
          name="nome"
          required
          maxLength={160}
          disabled={enviando}
          className={CONTROLE}
          placeholder="Mariana Costa"
        />
      </Field>

      <Field htmlFor="p-email" label="E-mail">
        <input
          id="p-email"
          name="email"
          type="email"
          required
          disabled={enviando}
          className={CONTROLE}
          placeholder="mariana@empresa.com.br"
        />
      </Field>

      <Field htmlFor="p-cargo" label="Cargo">
        <input
          id="p-cargo"
          name="cargo"
          maxLength={120}
          disabled={enviando}
          className={CONTROLE}
          placeholder="Coordenadora de curso"
        />
      </Field>

      <Field htmlFor="p-area" label="Área" hint="Opcional. Ajuda a ler a utilização por área.">
        <input
          id="p-area"
          name="area"
          maxLength={120}
          disabled={enviando}
          className={CONTROLE}
          placeholder="Graduação"
        />
      </Field>

      <Button type="submit" disabled={enviando}>
        {enviando ? "Criando…" : `Criar ${termoProfissional}`}
      </Button>

      <p className="text-[12px] leading-[1.45] text-[#8E7C86]">
        A conta nasce com carteira vazia e uma senha provisória que aparece uma vez só.
      </p>
    </form>
  );
}
