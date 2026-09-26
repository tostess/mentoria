import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

/**
 * O Next lê `.env.local`; o drizzle-kit não. Carregamos na mão.
 *
 * **Um arquivo por ambiente, escolhido por `DRIZZLE_ENV`.** A primeira versão
 * carregava só o `.env.local` com `override: true`, e isso tornava produção
 * inalcançável: variável passada na linha de comando era sobrescrita pelo
 * arquivo de desenvolvimento, então `DIRECT_URL=… npm run db:migrate` migrava o
 * `mentoria-dev` calado.
 *
 * A saída não é tirar o `override` — com precedência de shell, um `DIRECT_URL`
 * esquecido no terminal migra o banco errado sem avisar, e migração é a operação
 * que menos perdoa. A saída é exigir **duas** decisões explícitas para tocar em
 * produção: criar o arquivo e passar o ambiente. Invariante 17 no nível da
 * ferramenta.
 */
const ambiente = process.env.DRIZZLE_ENV === "production" ? "production" : "development";
const arquivo = ambiente === "production" ? ".env.production.local" : ".env.local";

loadEnv({ path: arquivo, override: true });

// DDL não passa pelo pooler de transação: sempre a conexão direta.
// `generate` não conecta em banco nenhum — só diffa o schema contra o journal.
// Por isso a ausência de URL não pode derrubar o config, só `migrate` e `studio`.
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "";

/**
 * Diz em voz alta o que vai ser tocado.
 *
 * Só o host e o projeto — nunca a senha. Sem isto, os dois ambientes são
 * indistinguíveis na saída do `db:migrate`, e a única forma de descobrir que se
 * migrou o banco errado é pelo estrago.
 */
if (url !== "") {
  const host = /@([^/?]+)/.exec(url)?.[1] ?? "host desconhecido";
  const ref = /postgres\.([a-z]+)/.exec(url)?.[1] ?? "ref desconhecida";
  console.log(`\n  drizzle-kit · ambiente ${ambiente} · ${arquivo}`);
  console.log(`  destino: ${host} · projeto ${ref}\n`);
} else if (ambiente === "production") {
  console.log(
    `\n  Falta ${arquivo} com DIRECT_URL do projeto de produção.` +
      `\n  Copie de .env.local.example e preencha com as credenciais do \`mentoria\`.\n`,
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema/index.ts",
  // Invariante: migração é arquivo versionado aqui, nunca mudança pelo painel.
  out: "./supabase/migrations",
  // Prefixo com timestamp para o nome bater com o do CLI do Supabase.
  migrations: { prefix: "supabase" },
  dbCredentials: { url },
  // O Supabase mantém esquemas próprios; o drizzle só enxerga o `public`.
  schemaFilter: ["public"],
  // `authenticated`, `anon` e `service_role` são do Supabase: o drizzle usa,
  // não gerencia. Sem isso ele geraria `create role` e `drop role` para eles.
  entities: { roles: { provider: "supabase" } },
  verbose: true,
  strict: true,
});
