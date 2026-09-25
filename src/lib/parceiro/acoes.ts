"use server";

import { refresh } from "next/cache";
import { IANAZone } from "luxon";
import { requireRole } from "@/lib/auth/session";
import {
  CampoInvalido,
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
import { paraMinutos } from "./horarios";

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
 * Modo rápido: um intervalo, os dias que ele escolher, toda semana.
 *
 * Substitui todas as regras em vez de acrescentar. É o que "modo rápido"
 * significa — o Parceiro está descrevendo a rotina inteira, não somando uma
 * linha. A grade detalhada, com horário diferente por dia, é a F3, e quando ela
 * chegar esta tela precisa avisar antes de sobrescrever.
 */
export async function salvarDisponibilidadeAcao(
  _anterior: FormState,
  form: FormData,
): Promise<FormState> {
  const userId = await exigeParceiro();

  return validando(async () => {
    const dias = form
      .getAll("dias")
      .filter((v): v is string => typeof v === "string")
      .map((v) => {
        if (!/^[0-6]$/.test(v)) throw new CampoInvalido("Dia da semana inválido.");
        return Number(v);
      });

    const unicos = [...new Set(dias)].sort((a, b) => a - b);
    if (unicos.length === 0) {
      throw new CampoInvalido("Escolha pelo menos um dia da semana.");
    }

    const inicioMin = paraMinutos(texto(form, "inicio", "o horário de início", 5));
    const fimMin = paraMinutos(texto(form, "fim", "o horário de término", 5));

    if (fimMin <= inicioMin) {
      throw new CampoInvalido("O término precisa ser depois do início.");
    }
    if (fimMin - inicioMin < 30) {
      throw new CampoInvalido("A janela precisa ter pelo menos 30 minutos — uma sessão inteira.");
    }

    const supabase = await createClient();

    // Apaga e reinsere. Duas idas ao banco, sem transação: o pior caso é o
    // Parceiro ficar um instante sem regra nenhuma, o que não desmarca sessão
    // (`bookings` já existe) nem perde dinheiro. Transação aqui exigiria função
    // no banco, e o ganho não paga.
    const apagou = await supabase.from("partner_rules").delete().eq("partner_id", userId);
    if (apagou.error !== null) throw new Error(`limpar regras: ${apagou.error.message}`);

    const inseriu = await supabase.from("partner_rules").insert(
      unicos.map((dia) => ({
        partner_id: userId,
        weekday: dia,
        start_min: inicioMin,
        end_min: fimMin,
      })),
    );
    if (inseriu.error !== null) throw new Error(`gravar regras: ${inseriu.error.message}`);

    refresh();
    return sucesso(
      unicos.length === 1
        ? "Disponibilidade salva para 1 dia da semana."
        : `Disponibilidade salva para ${unicos.length} dias da semana.`,
    );
  });
}

/** Limpa a rotina inteira. O Parceiro some da busca sem precisar ser pausado. */
export async function limparDisponibilidadeAcao(): Promise<FormState> {
  const userId = await exigeParceiro();

  return validando(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("partner_rules").delete().eq("partner_id", userId);
    if (error !== null) throw new Error(`limpar regras: ${error.message}`);

    refresh();
    return sucesso("Rotina apagada. Você não aparece com horário livre até configurar de novo.");
  });
}

const SENIORIDADES = ["", "pleno", "senior", "especialista", "executivo"] as const;

export async function salvarPerfilAcao(
  _anterior: FormState,
  form: FormData,
): Promise<FormState> {
  const userId = await exigeParceiro();

  return validando(async () => {
    const fuso = texto(form, "fuso", "o fuso horário", 64);
    if (!IANAZone.isValidZone(fuso)) {
      throw new CampoInvalido("Fuso horário desconhecido. Use algo como America/Sao_Paulo.");
    }

    const senioridade = textoOpcional(form, "senioridade", 40);
    if (senioridade !== null && !(SENIORIDADES as readonly string[]).includes(senioridade)) {
      throw new CampoInvalido("Senioridade inválida.");
    }

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
