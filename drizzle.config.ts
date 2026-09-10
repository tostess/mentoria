import "dotenv/config";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

// O Next lê `.env.local`; o drizzle-kit não. Carregamos na mão.
loadEnv({ path: ".env.local", override: true });

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    "DIRECT_URL (ou DATABASE_URL) ausente. Veja `.env.local.example`.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  // Invariante: migração é arquivo versionado aqui, nunca mudança pelo painel.
  out: "./supabase/migrations",
  // Prefixo com timestamp para o nome bater com o do CLI do Supabase.
  migrations: { prefix: "supabase" },
  // DDL não passa pelo pooler de transação: sempre a conexão direta.
  dbCredentials: { url },
  // O Supabase mantém esquemas próprios; o drizzle só enxerga o `public`.
  schemaFilter: ["public"],
  verbose: true,
  strict: true,
});
