import { notFound } from "next/navigation";
import { labAberto } from "@/app/api/lab/video/_lib/cerca";
import { LabVideo } from "./LabVideo";

/**
 * SPIKE P5-0 — laboratório de vídeo. Descartável; 404 em produção.
 *
 * Fica atrás do login pelo `proxy.ts` (rota sem papel: qualquer um que entrou
 * abre), e as rotas de `/api/lab/video` conferem a sessão por conta própria.
 */
export const dynamic = "force-dynamic";

export const metadata = { title: "Lab · vídeo" };

export default function LabVideoPage() {
  if (!labAberto()) notFound();
  return <LabVideo />;
}
