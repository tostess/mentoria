"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { loadAppConfig } from "@/lib/config/load";
import {
  CampoInvalido,
  cnpjOpcional,
  dataOpcional,
  email as campoEmail,
  falha,
  id as campoId,
  inteiro,
  lista,
  marcado,
  opcao,
  sucesso,
  texto,
  textoOpcional,
  validando,
  type FormState,
} from "@/lib/forms";
import {
  LancamentoRepetido,
  PagamentoNaoCreditavel,
  SaldoInsuficiente,
  TetoDaCarteira,
  TipoDeContaErrado,
  alocarFichas,
  registrarCompra,
  registrarCompraPessoal,
} from "@/lib/ledger";
import { chaveAlocacaoManual } from "@/lib/ledger/keys";
import {
  EmailJaUsado,
  ENGAJAMENTOS,
  criarContaPessoal,
  criarEmpresa,
  criarParceiro,
  criarProfissional,
} from "@/lib/pessoas/criar";
import {
  PessoaInexistente,
  STATUS_OPERAVEIS,
  TemSessaoFutura,
  TransicaoInvalida,
  alterarAcesso,
  alterarStatusDoParceiro,
  editarParceiro,
  editarProfissional,
  novaSenhaProvisoria,
} from "@/lib/pessoas/editar";
import { fuso as campoFuso, senioridade as campoSenioridade } from "@/lib/parceiro/validacao";
import { dia } from "@/lib/formato";
import { normalizeHex } from "@/lib/theme";
import { rotuloDoCampo } from "./atividade";
import { ehColaboradorDaEmpresa } from "./consultas";

/**
 * As ações do painel da operadora.
 *
 * Toda escrita privilegiada passa por aqui e cada função repete a autorização
 * do zero. A tela só renderizar o formulário para quem é `admin` não protege
 * nada: Server Action é um POST contra a rota, e quem souber o ID da ação
 * manda o POST sem abrir tela nenhuma.
 *
 * Só `admin`, nunca `moderator`. O moderador divide a casca com a operadora
 * mas não mexe em contrato — esse recorte vive aqui e na tela, não no matcher
 * de rota, porque os dois usam as mesmas URLs.
 *
 * Invariante 4: nenhuma destas funções escreve direto do cliente. O que elas
 * chamam é `lib/ledger` e `lib/pessoas`, onde vivem as transações.
 */

async function exigeOperadora() {
  const sessao = await requireRole("admin");
  return { id: sessao.userId, role: sessao.role };
}

/**
 * Traduz o que o banco recusou na frase que o admin lê.
 *
 * As exceções conhecidas são recusas legítimas — saldo que não dá, carteira
 * no teto, clique repetido, e-mail já usado, pessoa de outra empresa, status
 * que não pode ir para onde se pediu, sessão marcada no caminho. Qualquer outra coisa é
 * defeito, e é relançada para virar erro de verdade em vez de "não foi
 * possível" genérico que ninguém consegue depurar.
 */
async function executando(fn: () => Promise<FormState>): Promise<FormState> {
  return validando(async () => {
    try {
      return await fn();
    } catch (erro) {
      if (
        erro instanceof SaldoInsuficiente ||
        erro instanceof TetoDaCarteira ||
        erro instanceof LancamentoRepetido ||
        erro instanceof EmailJaUsado ||
        erro instanceof PessoaInexistente ||
        erro instanceof TransicaoInvalida ||
        erro instanceof TemSessaoFutura ||
        erro instanceof TipoDeContaErrado ||
        erro instanceof PagamentoNaoCreditavel
      ) {
        return falha(erro.message);
      }
      throw erro;
    }
  });
}

/** Fuso do Parceiro. Fixo no piloto; a tela de perfil abre isso na P2. */
const FUSO_PADRAO = "America/Sao_Paulo";

export async function criarEmpresaAcao(
  _anterior: FormState,
  form: FormData,
): Promise<FormState> {
  const ator = await exigeOperadora();

  return executando(async () => {
    const accentBruto = textoOpcional(form, "accent", 9);
    const accent = accentBruto === null ? null : normalizeHex(accentBruto);
    if (accentBruto !== null && accent === null) {
      throw new CampoInvalido("Cor da marca precisa ser um hex como #C2317A.");
    }

    const inicio = dataOpcional(form, "inicio", "A data de início");
    const fim = dataOpcional(form, "fim", "A data de fim");
    if (inicio !== null && fim !== null && fim < inicio) {
      throw new CampoInvalido("O fim do contrato não pode ser antes do início.");
    }

    const { id } = await criarEmpresa({
      nome: texto(form, "nome", "o nome da empresa", 160),
      cnpj: cnpjOpcional(form, "cnpj"),
      inicio,
      fim,
      accent,
      ator,
    });

    // Redirect vem depois da escrita e substitui o `refresh()`: a tela de
    // destino é renderizada do zero e já mostra a empresa criada.
    redirect(`/admin/empresas/${id}`);
  });
}

export async function registrarContratoAcao(
  _anterior: FormState,
  form: FormData,
): Promise<FormState> {
  const ator = await exigeOperadora();

  return executando(async () => {
    const orgId = campoId(form, "orgId", "A empresa");
    const fichas = inteiro(form, "fichas", "A quantidade de fichas", 1, 100_000);

    const { saldo } = await registrarCompra({
      orgId,
      fichas,
      referencia: textoOpcional(form, "referencia", 160),
      token: texto(form, "token", "o token do formulário", 64),
      ator,
    });

    refresh();
    return sucesso(`${fichas} fichas registradas. O contrato tem ${saldo} disponíveis.`);
  });
}

export async function criarProfissionalAcao(
  _anterior: FormState,
  form: FormData,
): Promise<FormState> {
  const ator = await exigeOperadora();

  return executando(async () => {
    const orgId = campoId(form, "orgId", "A empresa");
    const email = campoEmail(form, "email");

    const { senha } = await criarProfissional({
      orgId,
      nome: texto(form, "nome", "o nome", 160),
      email,
      cargo: textoOpcional(form, "cargo", 120),
      area: textoOpcional(form, "area", 120),
      ator,
    });

    refresh();
    return sucesso("Profissional criado. Repasse o acesso abaixo — ele aparece uma vez só.", {
      email,
      senha,
    });
  });
}

/**
 * Conta pessoal criada pela operadora — o caminho até o cadastro self-service
 * (A3). A pessoa recebe senha provisória, como o colaborador.
 */
export async function criarContaPessoalAcao(
  _anterior: FormState,
  form: FormData,
): Promise<FormState> {
  const ator = await exigeOperadora();

  return executando(async () => {
    const email = campoEmail(form, "email");

    const { senha } = await criarContaPessoal({
      nome: texto(form, "nome", "o nome", 160),
      email,
      telefone: textoOpcional(form, "telefone", 40),
      cargo: textoOpcional(form, "cargo", 120),
      area: textoOpcional(form, "area", 120),
      ator,
    });

    refresh();
    return sucesso("Conta criada. Repasse o acesso abaixo — ele aparece uma vez só.", {
      email,
      senha,
    });
  });
}

/**
 * Pacote pago fora da plataforma, registrado pela operadora. O pacote vem da
 * tabela de `app_config` pelo id — o formulário escolhe, mas preço e
 * quantidade são do servidor.
 */
export async function registrarCompraPessoalAcao(
  _anterior: FormState,
  form: FormData,
): Promise<FormState> {
  const ator = await exigeOperadora();
  const { pacotes, individualPolicy, terms } = await loadAppConfig();

  return executando(async () => {
    const userId = campoId(form, "userId", "A pessoa");
    const ativos = pacotes.filter((p) => p.ativo);
    const pacoteId = opcao(
      form,
      "pacote",
      "o pacote",
      ativos.map((p) => p.id),
    );
    const pacote = ativos.find((p) => p.id === pacoteId);
    if (pacote === undefined) throw new CampoInvalido("Escolha um pacote.");

    const { saldoCarteira, venceEm } = await registrarCompraPessoal({
      userId,
      pacote,
      validadeMeses: individualPolicy.validadeMeses,
      referencia: textoOpcional(form, "referencia", 160),
      token: texto(form, "token", "o token do formulário", 64),
      ator,
    });

    refresh();
    return sucesso(
      `${pacote.nome} registrado. A carteira ficou com ${saldoCarteira} ${
        saldoCarteira === 1 ? terms.ficha : terms.fichas
      }; estas valem até ${dia(venceEm)}.`,
    );
  });
}

export async function alocarFichasAcao(
  _anterior: FormState,
  form: FormData,
): Promise<FormState> {
  const ator = await exigeOperadora();
  const { fichaPolicy } = await loadAppConfig();

  return executando(async () => {
    const orgId = campoId(form, "orgId", "A empresa");
    const userId = campoId(form, "userId", "O colaborador");

    // A tela manda quem; o banco confirma que esse quem é da empresa. Sem esta
    // conferência, um POST forjado moveria ficha de um contrato para a carteira
    // de outra empresa — a carteira é travada de novo dentro da transação, e
    // esta checagem é o que produz a mensagem legível em vez do erro cru.
    if (!(await ehColaboradorDaEmpresa(orgId, userId))) {
      throw new CampoInvalido("Este colaborador não pertence à empresa.");
    }

    const quantidade = inteiro(form, "quantidade", "A quantidade", 1, fichaPolicy.maxBalance);

    const { saldoContrato, saldoCarteira } = await alocarFichas({
      orgId,
      userId,
      quantidade,
      tetoCarteira: fichaPolicy.maxBalance,
      // A chave é montada aqui, e não dentro da operação: o cron da alocação
      // mensal monta a dele com outro formato, e é essa diferença que impede um
      // caminho de silenciar o outro.
      chave: chaveAlocacaoManual(userId, texto(form, "token", "o token do formulário", 64)),
      ator,
    });

    refresh();
    return sucesso(
      `Alocadas. A carteira ficou com ${saldoCarteira} e o contrato com ${saldoContrato}.`,
    );
  });
}

export async function criarParceiroAcao(
  _anterior: FormState,
  form: FormData,
): Promise<FormState> {
  const ator = await exigeOperadora();

  return executando(async () => {
    const email = campoEmail(form, "email");

    const { senha } = await criarParceiro({
      nome: texto(form, "nome", "o nome", 160),
      email,
      headline: textoOpcional(form, "headline", 160),
      bio: textoOpcional(form, "bio", 2000),
      areas: lista(form, "areas"),
      engajamento: opcao(form, "engajamento", "o vínculo", ENGAJAMENTOS),
      maxPorSemana: inteiro(form, "maxPorSemana", "As sessões por semana", 1, 40),
      fuso: FUSO_PADRAO,
      ator,
    });

    refresh();
    return sucesso("Parceiro criado e ativo. Repasse o acesso abaixo — ele aparece uma vez só.", {
      email,
      senha,
    });
  });
}

/** "Salvo. Mudou: chamada, áreas." — ou o aviso de que nada mudou. */
function resumoDaEdicao(campos: string[]): FormState {
  if (campos.length === 0) return sucesso("Nada para salvar: os dados já eram estes.");
  return sucesso(`Salvo. Mudou: ${campos.map(rotuloDoCampo).join(", ")}.`);
}

export async function editarParceiroAcao(
  _anterior: FormState,
  form: FormData,
): Promise<FormState> {
  const ator = await exigeOperadora();

  return executando(async () => {
    const id = campoId(form, "id", "A pessoa");

    const { campos } = await editarParceiro(
      id,
      {
        nome: texto(form, "nome", "o nome", 160),
        email: campoEmail(form, "email"),
        fuso: campoFuso(form),
        headline: textoOpcional(form, "headline", 160),
        bio: textoOpcional(form, "bio", 2000),
        areas: lista(form, "areas"),
        habilidades: lista(form, "habilidades"),
        senioridade: campoSenioridade(form),
        engajamento: opcao(form, "engajamento", "o vínculo", ENGAJAMENTOS),
        maxPorSemana: inteiro(form, "maxPorSemana", "O teto semanal", 1, 40),
        bufferMin: inteiro(form, "bufferMin", "O descanso entre sessões", 0, 120),
        confirmaSozinho: marcado(form, "confirmaSozinho"),
      },
      ator,
    );

    refresh();
    return resumoDaEdicao(campos);
  });
}

const MENSAGEM_DE_STATUS: Record<(typeof STATUS_OPERAVEIS)[number], string> = {
  active: "Reativado. Volta a aparecer na busca e a entrar normalmente.",
  paused: "Pausado. Some da busca; o acesso e as sessões já marcadas continuam.",
  archived: "Arquivado. Some da busca e perde o acesso. Dá para reativar depois.",
};

export async function alterarStatusParceiroAcao(
  _anterior: FormState,
  form: FormData,
): Promise<FormState> {
  const ator = await exigeOperadora();

  return executando(async () => {
    const id = campoId(form, "id", "A pessoa");
    const status = opcao(form, "status", "o status", STATUS_OPERAVEIS);

    await alterarStatusDoParceiro(id, status, ator);

    refresh();
    return sucesso(MENSAGEM_DE_STATUS[status]);
  });
}

export async function editarProfissionalAcao(
  _anterior: FormState,
  form: FormData,
): Promise<FormState> {
  const ator = await exigeOperadora();

  return executando(async () => {
    const orgId = campoId(form, "orgId", "A empresa");
    const id = campoId(form, "id", "A pessoa");

    const { campos } = await editarProfissional(
      id,
      orgId,
      {
        nome: texto(form, "nome", "o nome", 160),
        email: campoEmail(form, "email"),
        cargo: textoOpcional(form, "cargo", 120),
        area: textoOpcional(form, "area", 120),
      },
      ator,
    );

    refresh();
    return resumoDaEdicao(campos);
  });
}

export async function alterarAcessoAcao(
  _anterior: FormState,
  form: FormData,
): Promise<FormState> {
  const ator = await exigeOperadora();

  return executando(async () => {
    const orgId = campoId(form, "orgId", "A empresa");
    const id = campoId(form, "id", "A pessoa");
    const ativo = opcao(form, "ativo", "o estado do acesso", ["sim", "nao"] as const) === "sim";

    const { mudou } = await alterarAcesso(id, orgId, ativo, ator);

    refresh();
    if (!mudou) return sucesso(ativo ? "O acesso já estava ativo." : "O acesso já estava desativado.");
    return sucesso(
      ativo
        ? "Acesso reativado. A próxima entrada já funciona."
        : "Acesso desativado. A próxima entrada é recusada; a carteira e o histórico ficam.",
    );
  });
}

export async function novaSenhaAcao(
  _anterior: FormState,
  form: FormData,
): Promise<FormState> {
  const ator = await exigeOperadora();

  return executando(async () => {
    const id = campoId(form, "id", "A pessoa");
    const papel = opcao(form, "papel", "o tipo de conta", ["partner", "professional"] as const);
    const alvo =
      papel === "partner"
        ? ({ papel } as const)
        : ({ papel, orgId: campoId(form, "orgId", "A empresa") } as const);

    const credencial = await novaSenhaProvisoria(id, alvo, ator);

    refresh();
    return sucesso(
      "Senha nova gerada. A anterior deixou de valer — repasse esta, que aparece uma vez só.",
      credencial,
    );
  });
}
