/**
 * Regras da troca de senha feita pela própria pessoa.
 *
 * Módulo puro: a Server Action valida aqui antes de falar com o servidor de
 * auth, e o teste confere as mesmas regras sem rede.
 *
 * O mínimo é 8, acima dos 6 do Supabase: a senha provisória tem 16 e trocar
 * por algo mais fraco que ela seria andar para trás. O máximo é 72 porque o
 * bcrypt ignora o que passa disso — aceitar 100 caracteres e conferir só 72
 * seria mentir para quem digitou.
 */

export const SENHA_MIN = 8;
export const SENHA_MAX = 72;

/**
 * Chave em `auth.users.raw_app_meta_data`, que chega ao JWT como
 * `app_metadata.senha_provisoria`. Só o `service_role` escreve.
 */
export const CHAVE_SENHA_PROVISORIA = "senha_provisoria";

/**
 * Senha escolhida no cadastro (A3) — os mesmos limites da troca, sem a senha
 * atual, que ainda não existe.
 */
export function problemaNaSenhaNova(senha: string, confirmacao: string): string | null {
  if (senha === "") return "Crie uma senha.";
  if (senha.length < SENHA_MIN) return `A senha precisa de pelo menos ${SENHA_MIN} caracteres.`;
  if (senha.length > SENHA_MAX) return `A senha pode ter no máximo ${SENHA_MAX} caracteres.`;
  if (senha.trim() !== senha) return "A senha não pode começar nem terminar com espaço.";
  if (senha !== confirmacao) return "A confirmação não é igual à senha.";
  return null;
}

export type TrocaDeSenha = { atual: string; nova: string; confirmacao: string };

/** Devolve a mensagem para a tela, ou null quando está tudo certo. */
export function problemaNaTroca({ atual, nova, confirmacao }: TrocaDeSenha): string | null {
  if (atual === "") return "Digite a senha que você usa hoje.";
  if (nova === "") return "Digite a senha nova.";
  if (nova.length < SENHA_MIN) return `A senha nova precisa de pelo menos ${SENHA_MIN} caracteres.`;
  if (nova.length > SENHA_MAX) return `A senha nova pode ter no máximo ${SENHA_MAX} caracteres.`;
  if (nova.trim() !== nova) return "A senha nova não pode começar nem terminar com espaço.";
  if (nova !== confirmacao) return "A confirmação não é igual à senha nova.";
  if (nova === atual) return "A senha nova precisa ser diferente da atual.";
  return null;
}
