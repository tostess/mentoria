"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { PedidoInexistente, PedidoJaDecidido, aprovarPedidos, recusarPedido } from "@/lib/cadastro";
import { loadAppConfig } from "@/lib/config/load";
import {
  CampoInvalido,
  cnpjOpcional,
  dataOpcional,
  ehId,
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
import { mergeBranding } from "@/lib/config/app-config";
import { EmpresaInexistente, salvarMarca } from "@/lib/marca";
import { ROTULO_DA_COR, logotipoValido, problemasDeLeitura } from "@/lib/marca/regras";
import { CORES_DA_MARCA, DEFAULT_THEME, normalizeHex, resolveTheme, type AjustesDeCor } from "@/lib/theme";
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
        erro instanceof PagamentoNaoCreditavel ||
        erro instanceof PedidoJaDecidido ||
        erro instanceof PedidoInexistente ||
        erro instanceof EmpresaInexistente
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

/** Hex opcional; preenchido e inválido é erro, com o nome do campo. */
function corOpcional(form: FormData, nome: string, rotulo: string): string | null {
  const bruto = textoOpcional(form, nome, 9);
  if (bruto === null) return null;
  const hex = normalizeHex(bruto);
  if (hex === null) throw new CampoInvalido(`${rotulo} precisa ser um hex como #C2317A.`);
  return hex;
}

/**
 * A marca da empresa (F4b). Campo em branco é "herdar da plataforma"; do
 * ajuste fino chegam só as cores que a operadora mexeu, e a transação ainda
 * descarta a que ficou igual à derivada.
 */
export async function editarMarcaAcao(
  _anterior: FormState,
  form: FormData,
): Promise<FormState> {
  const ator = await exigeOperadora();

  return executando(async () => {
    const orgId = campoId(form, "orgId", "A empresa");
    const accent = corOpcional(form, "accent", "A cor principal");
    const nomeNaMarca = textoOpcional(form, "nomeNaMarca", 40);
    const logotipo = textoOpcional(form, "logotipo", 500);
    if (logotipo !== null && !logotipoValido(logotipo)) {
      throw new CampoInvalido("O logotipo precisa ser um endereço https://, como https://exemplo.com.br/logo.png.");
    }

    const cores: AjustesDeCor = {};
    for (const cor of CORES_DA_MARCA) {
      const hex = corOpcional(form, `cor_${cor}`, ROTULO_DA_COR[cor]);
      if (hex !== null) cores[cor] = hex;
    }

    // A conferência de leitura olha o tema que a empresa vai ver de verdade,
    // com a plataforma por baixo — o mesmo que `loadTheme` monta.
    const plataforma = (await loadAppConfig()).branding;
    const tema = resolveTheme(mergeBranding(plataforma, { accent, name: nomeNaMarca, logoUrl: logotipo, cores }));
    const [problema] = problemasDeLeitura(tema);
    if (problema !== undefined) throw new CampoInvalido(problema);

    const { campos } = await salvarMarca(
      orgId,
      { accent, nomeNaMarca, logotipo, cores },
      ator,
      plataforma.accent ?? DEFAULT_THEME.accent,
    );

    refresh();
    return resumoDaEdicao(campos);
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

/** Quantos pedidos uma aprovação em lote aceita — uma transação por pessoa, em sequência. */
const LOTE_MAX = 50;

/**
 * Aprova os pedidos de cadastro selecionados (A3), um por transação. O que não
 * passou — e-mail sem confirmar, pedido que outra pessoa decidiu — volta na
 * mesma tela, sem impedir os outros.
 */
export async function aprovarCadastrosAcao(
  _anterior: FormState,
  form: FormData,
): Promise<FormState> {
  const ator = await exigeOperadora();

  return executando(async () => {
    const brutos = form.getAll("pedido").filter((v): v is string => typeof v === "string");
    const ids = [...new Set(brutos.map((v) => v.trim().toLowerCase()))];
    if (ids.length === 0) throw new CampoInvalido("Selecione ao menos um pedido.");
    if (ids.length > LOTE_MAX) throw new CampoInvalido(`No máximo ${LOTE_MAX} pedidos por vez.`);
    if (ids.some((id) => !ehId(id))) throw new CampoInvalido("Um dos pedidos não foi informado corretamente.");

    const { aprovados, falhas } = await aprovarPedidos(ids, ator);
    if (aprovados.length > 0) refresh();

    const ok =
      aprovados.length === 0
        ? null
        : aprovados.length === 1
          ? `Cadastro de ${aprovados[0]} aprovado. A conta já entra com o e-mail e a senha do pedido.`
          : `${aprovados.length} cadastros aprovados. As contas já entram com o e-mail e a senha de cada pedido.`;
    return { erro: falhas.length === 0 ? null : falhas.join(" "), ok, credencial: null };
  });
}

/**
 * Recusa um pedido. O motivo é interno — fica no pedido para a operadora, até a
 * anonimização de 90 dias, e não vai para a auditoria nem para a pessoa.
 */
export async function recusarCadastroAcao(
  _anterior: FormState,
  form: FormData,
): Promise<FormState> {
  const ator = await exigeOperadora();

  return executando(async () => {
    const id = campoId(form, "pedido", "O pedido");
    const motivo = textoOpcional(form, "motivo", 500);
    const nome = await recusarPedido(id, ator, motivo);
    refresh();
    return sucesso(`Pedido de ${nome} recusado.`);
  });
}
