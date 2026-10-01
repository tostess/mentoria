"use server";

import { refresh } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { DURACAO_DA_SESSAO_MIN } from "@/lib/config/limites";
import {
  CampoInvalido,
  ehId,
  inteiro,
  lista,
  marcado,
  sucesso,
  texto,
  textoOpcional,
  validando,
  type FormState,
} from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { carregarOcupacoes } from "./dados";
import { lerGrade, linhasDaFolga, noRelogio, sessoesNoBloqueio, validarGrade } from "./grade";
import { HorarioInvalido, paraMinutos } from "./horarios";
import { fuso as campoFuso, senioridade as campoSenioridade } from "./validacao";

/**
 * O que o Parceiro muda em si mesmo.
 *
 * Escreve pelo cliente da sessão dele, e não por `service_role`: a Etapa 3 já
 * deu a ele policy de `all` nas próprias regras e privilégio de coluna no
 * próprio perfil. A RLS é quem garante que ele não escreve na agenda de outro —
 * o `partner_id` nem é aceito como parâmetro, vem do JWT.
 *
 * Sem `audit_logs`: a invariante 12 pede registro de ação de admin, moderador e
 * RH. Parceiro ajustando a própria agenda não é ação sobre terceiro. A exceção
 * é a invariante 18 — correção de presença —, que chega na P5.
 */

async function exigeParceiro() {
  const sessao = await requireRole("partner");
  return sessao.userId;
}

/**
 * A grade semanal inteira: cada dia com as faixas que o Parceiro quiser.
 *
 * Substitui todas as regras em vez de acrescentar — a tela manda a semana
 * completa, do jeito que ele a vê. O antigo modo rápido ("os mesmos horários em
 * vários dias") virou um atalho que só preenche a grade no cliente; nada é
 * salvo sem ele ver o resultado, e por isso não há mais o que sobrescrever sem
 * aviso. Grade vazia é válida: é ele saindo da busca sem precisar ser pausado.
 */
export async function salvarGradeAcao(_anterior: FormState, form: FormData): Promise<FormState> {
  const userId = await exigeParceiro();

  return validando(async () => {
    const bruto = form.get("grade");
    const grade = validarGrade(
      lerGrade(typeof bruto === "string" ? bruto : ""),
      DURACAO_DA_SESSAO_MIN,
    );

    const supabase = await createClient();

    // Apaga e reinsere. Duas idas ao banco, sem transação: o pior caso é o
    // Parceiro ficar um instante sem regra nenhuma, o que não desmarca sessão
    // (`bookings` já existe) nem perde dinheiro. Transação aqui exigiria função
    // no banco, e o ganho não paga.
    const apagou = await supabase.from("partner_rules").delete().eq("partner_id", userId);
    if (apagou.error !== null) throw new Error(`limpar regras: ${apagou.error.message}`);

    if (grade.length > 0) {
      const inseriu = await supabase.from("partner_rules").insert(
        grade.map((faixa) => ({
          partner_id: userId,
          weekday: faixa.dia,
          start_min: faixa.inicioMin,
          end_min: faixa.fimMin,
        })),
      );
      if (inseriu.error !== null) throw new Error(`gravar regras: ${inseriu.error.message}`);
    }

    refresh();
    if (grade.length === 0) {
      return sucesso("Rotina vazia. Você não aparece com horário livre até abrir algum dia.");
    }
    const dias = new Set(grade.map((faixa) => faixa.dia)).size;
    return sucesso(
      dias === 1 ? "Rotina salva para 1 dia da semana." : `Rotina salva para ${dias} dias da semana.`,
    );
  });
}

/** A data de hoje no relógio do Parceiro — a fronteira do que já passou. */
async function hojeDoParceiro(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<{ hoje: string; fuso: string }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .maybeSingle();
  if (error !== null) throw new Error(`fuso: ${error.message}`);
  const fuso =
    data !== null && typeof (data as Record<string, unknown>).timezone === "string"
      ? ((data as Record<string, unknown>).timezone as string)
      : "America/Sao_Paulo";
  return { hoje: noRelogio(new Date(), fuso).dia, fuso };
}

function horaOpcional(form: FormData, nome: string, rotulo: string): number {
  const valor = form.get(nome);
  if (typeof valor !== "string" || valor.trim() === "") {
    throw new CampoInvalido(`Preencha ${rotulo}.`);
  }
  try {
    return paraMinutos(valor);
  } catch (erro) {
    if (erro instanceof HorarioInvalido) throw new CampoInvalido(erro.message);
    throw erro;
  }
}

/**
 * Folga (férias, um dia, uma manhã) ou horário extra num dia específico.
 *
 * Uma linha de `partner_exceptions` por dia, que é o que o motor lê. Sem
 * `reason`: a policy de leitura abre as exceções de Parceiro ativo a todo
 * autenticado — é a agenda pública dele —, e "cirurgia" ou "férias na Bahia"
 * escritos ali seriam lidos por qualquer Profissional de qualquer empresa.
 *
 * Bloquear não desmarca ninguém. A mensagem diz quantas sessões já marcadas
 * caem no período, para o Parceiro decidir se cancela pela agenda — cancelar
 * mexe na ficha de outra pessoa e é gesto dele, não efeito colateral.
 */
export async function adicionarFolgaAcao(
  _anterior: FormState,
  form: FormData,
): Promise<FormState> {
  const userId = await exigeParceiro();

  return validando(async () => {
    const tipo = form.get("tipo") === "extra" ? ("extra" as const) : ("bloqueio" as const);
    const diaInteiro = tipo === "bloqueio" && marcado(form, "diaInteiro");
    const de = texto(form, "de", "a data", 10);
    const ate = tipo === "extra" ? de : texto(form, "ate", "a data de término", 10);
    const inicioMin = diaInteiro ? null : horaOpcional(form, "inicio", "o horário de início");
    const fimMin = diaInteiro ? null : horaOpcional(form, "fim", "o horário de término");

    const supabase = await createClient();
    const { hoje, fuso } = await hojeDoParceiro(supabase, userId);
    const linhas = linhasDaFolga({ tipo, de, ate, inicioMin, fimMin }, hoje, DURACAO_DA_SESSAO_MIN);

    const { error } = await supabase.from("partner_exceptions").insert(
      linhas.map((linha) => ({
        partner_id: userId,
        day: linha.dia,
        kind: linha.tipo === "bloqueio" ? "block" : "extra",
        start_min: linha.inicioMin,
        end_min: linha.fimMin,
      })),
    );
    if (error !== null) throw new Error(`gravar folga: ${error.message}`);

    refresh();

    if (tipo === "extra") return sucesso("Horário extra aberto.");

    const ocupacoes = await carregarOcupacoes(userId, new Date());
    const marcadas = sessoesNoBloqueio(
      { tipo, de, ate, inicioMin, fimMin },
      ocupacoes.map((o) => ({ inicio: noRelogio(o.inicio, fuso), fim: noRelogio(o.fim, fuso) })),
    );
    const base = linhas.length === 1 ? "Folga salva." : `Folga salva para ${linhas.length} dias.`;
    if (marcadas === 0) return sucesso(base);
    return sucesso(
      `${base} ${marcadas === 1 ? "A sessão que já estava marcada nesse período continua de pé" : `As ${marcadas} sessões que já estavam marcadas nesse período continuam de pé`} — se não for atender, cancele pela agenda.`,
    );
  });
}

/** Remove um período de folga ou um horário extra — todas as linhas do grupo. */
export async function removerFolgaAcao(
  _anterior: FormState,
  form: FormData,
): Promise<FormState> {
  const userId = await exigeParceiro();

  return validando(async () => {
    const ids = form
      .getAll("ids")
      .filter((v): v is string => typeof v === "string" && ehId(v));
    if (ids.length === 0) throw new CampoInvalido("Nada para remover.");

    const supabase = await createClient();
    // O `partner_id` é redundante com a policy, e está aqui de propósito: se a
    // policy afrouxar um dia, a tela continua apagando só o que é dele.
    const { error } = await supabase
      .from("partner_exceptions")
      .delete()
      .in("id", ids)
      .eq("partner_id", userId);
    if (error !== null) throw new Error(`remover folga: ${error.message}`);

    refresh();
    return sucesso("Removido.");
  });
}

export async function salvarPerfilAcao(
  _anterior: FormState,
  form: FormData,
): Promise<FormState> {
  const userId = await exigeParceiro();

  return validando(async () => {
    const fuso = campoFuso(form);
    const senioridade = campoSenioridade(form);

    const supabase = await createClient();

    // `profiles` e `partners` são duas tabelas; a primeira guarda quem a pessoa
    // é e a segunda o que ela oferece. O privilégio de coluna da Etapa 3 recusa
    // qualquer coluna fora da lista — `role` e `status` inclusive.
    const perfil = await supabase
      .from("profiles")
      .update({ name: texto(form, "nome", "o seu nome", 160), timezone: fuso })
      .eq("id", userId);
    if (perfil.error !== null) throw new Error(`perfil: ${perfil.error.message}`);

    const parceiro = await supabase
      .from("partners")
      .update({
        headline: textoOpcional(form, "headline", 160),
        bio: textoOpcional(form, "bio", 2000),
        areas: lista(form, "areas"),
        skills: lista(form, "habilidades"),
        seniority: senioridade,
        buffer_min: inteiro(form, "bufferMin", "O descanso entre sessões", 0, 120),
        max_per_week: inteiro(form, "maxPorSemana", "O teto semanal", 1, 40),
        auto_confirm: marcado(form, "confirmaSozinho"),
      })
      .eq("id", userId);
    if (parceiro.error !== null) throw new Error(`parceiro: ${parceiro.error.message}`);

    refresh();
    return sucesso("Perfil salvo.");
  });
}
