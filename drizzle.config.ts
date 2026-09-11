import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

// O Next lê `.env.local`; o drizzle-kit não. Carregamos na mão.
loadEnv({ path: ".env.local", override: true });

// DDL não passa pelo pooler de transação: sempre a conexão direta.
// `generate` não conecta em banco nenhum — só diffa o schema contra o journal.
// Por isso a ausência de URL não pode derrubar o config, só `migrate` e `studio`.
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "";

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
