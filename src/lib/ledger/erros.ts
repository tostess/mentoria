/**
 * As recusas legítimas do livro-caixa, e como reconhecê-las.
 *
 * Módulo sem `server-only` de propósito: não lê segredo e não abre conexão.
 * As classes precisam ser visíveis de fora do servidor para que a tela possa
 * distinguir "não deu porque faltou saldo" de "não deu porque quebrou".
 */

export class SaldoInsuficiente extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "SaldoInsuficiente";
  }
}

export class LancamentoRepetido extends Error {
  constructor() {
    super("Este lançamento já foi registrado.");
    this.name = "LancamentoRepetido";
  }
}

export class TetoDaCarteira extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "TetoDaCarteira";
  }
}

/**
 * O horário pedido não está entre os que o motor oferece.
 *
 * Invariante 14 aplicada na escrita: a reserva não confia no instante que chega
 * do cliente, recalcula a agenda e confere. Pode ser corrida (alguém pegou
 * primeiro), pode ser tela velha, pode ser pedido forjado — a resposta é a
 * mesma, e o motivo do motor vai na mensagem quando existir.
 */
export class HorarioIndisponivel extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "HorarioIndisponivel";
  }
}

/** Já há pedidos demais esperando resposta do Parceiro. */
export class LimiteDePendentes extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "LimiteDePendentes";
  }
}

function codigo(erro: unknown): string | null {
  if (typeof erro !== "object" || erro === null || !("code" in erro)) return null;
  const valor = (erro as { code: unknown }).code;
  return typeof valor === "string" ? valor : null;
}

/** `23505` é violação de unicidade; a única chave única aqui é a de idempotência. */
export function ehChaveRepetida(erro: unknown): boolean {
  return codigo(erro) === "23505";
}

/** `23514` é violação de `check` — nos livros-caixa, sempre `balance >= 0`. */
export function ehSaldoNegativo(erro: unknown): boolean {
  return codigo(erro) === "23514";
}

/**
 * `23P01` é violação de constraint de exclusão — aqui, sempre
 * `bookings_no_overlap` (invariante 7).
 *
 * É o caso em que duas pessoas mirando o mesmo horário chegam juntas: o banco
 * deixa uma passar e recusa a outra. Não é defeito, é a corrida sendo decidida
 * onde ela tem de ser decidida — e quem perdeu precisa ler "esse horário acabou
 * de ser tomado", não o texto da constraint.
 */
export function ehSobreposicao(erro: unknown): boolean {
  return codigo(erro) === "23P01";
}

/**
 * Traduz o erro do Postgres na causa que o usuário entende.
 *
 * Reconhecer pelo código do erro, e não conferindo o saldo antes do insert, é
 * o ponto: a checagem prévia perde a corrida com um segundo clique, a
 * constraint não perde. Este código roda depois que o banco já disse não.
 */
export async function comTraducao<T>(
  fn: () => Promise<T>,
  aoFaltarSaldo: string,
  aoSobrepor = "Esse horário acabou de ser tomado. Escolha outro.",
): Promise<T> {
  try {
    return await fn();
  } catch (erro) {
    if (ehChaveRepetida(erro)) throw new LancamentoRepetido();
    if (ehSaldoNegativo(erro)) throw new SaldoInsuficiente(aoFaltarSaldo);
    if (ehSobreposicao(erro)) throw new HorarioIndisponivel(aoSobrepor);
    throw erro;
  }
}
