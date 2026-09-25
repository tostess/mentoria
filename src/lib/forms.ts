/**
 * Leitura e validação de `FormData`.
 *
 * Server Action é endpoint público: quem sabe o ID da ação manda o POST que
 * quiser, sem passar pela tela. Então nada que chega aqui é confiável, e cada
 * campo é convertido e validado uma vez, na borda, antes de virar SQL.
 *
 * Módulo puro — sem `next/*`, sem banco. As mensagens de erro são as que o
 * usuário lê, em português e dizendo o que fazer.
 */

/**
 * Credencial provisória de uma conta recém-criada.
 *
 * Volta uma única vez, no resultado da ação que criou a pessoa, porque o
 * piloto não tem envio de e-mail e alguém precisa repassar o acesso à mão.
 * Não é lida de volta em lugar nenhum — o banco guarda o hash, não a senha.
 */
export type Credencial = { email: string; senha: string };

/** O que uma Server Action devolve para `useActionState`. */
export type FormState = {
  erro: string | null;
  ok: string | null;
  credencial: Credencial | null;
};

export const FORM_INICIAL: FormState = { erro: null, ok: null, credencial: null };

export function falha(erro: string): FormState {
  return { erro, ok: null, credencial: null };
}

export function sucesso(ok: string, credencial: Credencial | null = null): FormState {
  return { erro: null, ok, credencial };
}

/** Erro de validação. A mensagem é para a tela, não para o log. */
export class CampoInvalido extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "CampoInvalido";
  }
}

/**
 * Executa a validação e devolve `FormState` em vez de estourar.
 *
 * `CampoInvalido` volta como mensagem para o usuário; qualquer outro erro é
 * relançado, porque falha de banco não é problema de preenchimento e não pode
 * virar "confira os campos".
 */
export async function validando(fn: () => Promise<FormState>): Promise<FormState> {
  try {
    return await fn();
  } catch (erro) {
    if (erro instanceof CampoInvalido) return falha(erro.message);
    throw erro;
  }
}

function bruto(form: FormData, nome: string): string {
  const valor = form.get(nome);
  return typeof valor === "string" ? valor.trim() : "";
}

/** Texto opcional: vazio vira null, para não gravar string vazia na coluna. */
export function textoOpcional(form: FormData, nome: string, max = 500): string | null {
  const valor = bruto(form, nome);
  if (valor === "") return null;
  if (valor.length > max) {
    throw new CampoInvalido(`Texto muito longo — o limite é ${max} caracteres.`);
  }
  return valor;
}

export function texto(form: FormData, nome: string, rotulo: string, max = 500): string {
  const valor = textoOpcional(form, nome, max);
  if (valor === null) throw new CampoInvalido(`Preencha ${rotulo}.`);
  return valor;
}

/**
 * E-mail. A validação é deliberadamente frouxa — exige arroba, um ponto no
 * domínio e nada de espaço. Regra apertada rejeita endereço válido, e quem
 * decide de verdade se o e-mail existe é o convite que chega nele.
 */
const EMAIL = /^[^\s@]+@[^\s@.]+\.[^\s@]+$/;

export function email(form: FormData, nome: string): string {
  const valor = texto(form, nome, "o e-mail", 320).toLowerCase();
  if (!EMAIL.test(valor)) throw new CampoInvalido("E-mail inválido.");
  return valor;
}

/** Inteiro numa faixa fechada. String vazia e decimal não passam. */
export function inteiro(
  form: FormData,
  nome: string,
  rotulo: string,
  min: number,
  max: number,
): number {
  const valor = bruto(form, nome);
  if (valor === "") throw new CampoInvalido(`Preencha ${rotulo}.`);
  if (!/^-?\d+$/.test(valor)) throw new CampoInvalido(`${rotulo} precisa ser um número inteiro.`);
  const n = Number(valor);
  if (n < min || n > max) {
    throw new CampoInvalido(`${rotulo} precisa estar entre ${min} e ${max}.`);
  }
  return n;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Identificador que a tela manda de volta. Validar o formato não prova que a
 * linha é do escopo de quem chama — isso é conferido na consulta, com o papel
 * e o `org_id` da sessão. Aqui só se recusa o que nem chega a ser um id.
 */
export function id(form: FormData, nome: string, rotulo: string): string {
  const valor = bruto(form, nome);
  if (!UUID.test(valor)) throw new CampoInvalido(`${rotulo} não foi informado corretamente.`);
  return valor.toLowerCase();
}

/** Data `YYYY-MM-DD` de `<input type="date">`, ou null quando em branco. */
export function dataOpcional(form: FormData, nome: string, rotulo: string): string | null {
  const valor = bruto(form, nome);
  if (valor === "") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) throw new CampoInvalido(`${rotulo} inválida.`);
  const [ano, mes, dia] = valor.split("-").map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  // Rejeita 31/02: o `Date` normaliza para 03/03 em vez de reclamar.
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) {
    throw new CampoInvalido(`${rotulo} inválida.`);
  }
  return valor;
}

/**
 * CNPJ: guarda só os 14 dígitos. Não confere dígito verificador — o dado vem
 * do contrato assinado, e recusar um CNPJ real por causa de um checksum mal
 * implementado custa mais do que aceitar um errado que o RH corrige.
 */
export function cnpjOpcional(form: FormData, nome: string): string | null {
  const valor = bruto(form, nome);
  if (valor === "") return null;
  const digitos = valor.replace(/\D/g, "");
  if (digitos.length !== 14) throw new CampoInvalido("CNPJ precisa ter 14 dígitos.");
  return digitos;
}

/** "Liderança, Saúde" → `["Liderança","Saúde"]`, sem vazio e sem repetido. */
export function lista(form: FormData, nome: string, max = 12): string[] {
  const valor = bruto(form, nome);
  if (valor === "") return [];
  const itens = [...new Set(valor.split(",").map((item) => item.trim()).filter(Boolean))];
  if (itens.length > max) throw new CampoInvalido(`No máximo ${max} itens.`);
  return itens;
}

/**
 * Vários valores inteiros do mesmo campo — caixas de seleção com o mesmo
 * `name`. Descarta repetido e ordena, porque "Ter, Seg, Ter" e "Seg, Ter" são a
 * mesma escolha e não podem virar duas linhas diferentes no banco.
 */
export function inteiros(
  form: FormData,
  nome: string,
  rotulo: string,
  min: number,
  max: number,
): number[] {
  const brutos = form.getAll(nome).filter((v): v is string => typeof v === "string");
  const numeros = brutos.map((valor) => {
    if (!/^-?\d+$/.test(valor.trim())) {
      throw new CampoInvalido(`${rotulo} tem um valor inválido.`);
    }
    const n = Number(valor);
    if (n < min || n > max) throw new CampoInvalido(`${rotulo} tem um valor fora da faixa.`);
    return n;
  });
  return [...new Set(numeros)].sort((a, b) => a - b);
}

/** Caixa marcada. `<input type="checkbox">` só envia o campo quando marcado. */
export function marcado(form: FormData, nome: string): boolean {
  return form.get(nome) !== null;
}

/** Valor que precisa estar num conjunto fechado — `select` de enum. */
export function opcao<T extends string>(
  form: FormData,
  nome: string,
  rotulo: string,
  validas: readonly T[],
): T {
  const valor = bruto(form, nome);
  if (!(validas as readonly string[]).includes(valor)) {
    throw new CampoInvalido(`Escolha ${rotulo}.`);
  }
  return valor as T;
}
