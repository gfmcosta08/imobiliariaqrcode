"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

type LeadUpdateInput = {
  leadId: string;
  nome_completo: string;
  primeiro_nome: string;
  observacoes: string;
  interesses: string;
  status: string;
  nome_validado: boolean;
};

function parseInteresses(raw: string): string[] {
  return raw
    .split(/[\n,]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function updateLead(input: LeadUpdateInput) {
  const leadId = String(input.leadId ?? "").trim();
  if (!leadId) {
    return { error: "Lead invalido." };
  }

  const nomeCompleto = String(input.nome_completo ?? "").trim();
  if (!nomeCompleto) {
    return { error: "Nome completo e obrigatorio." };
  }

  const primeiroNome = String(input.primeiro_nome ?? "").trim() || nomeCompleto.split(" ")[0] || "Cliente";
  const observacoes = String(input.observacoes ?? "").trim();
  const interesses = parseInteresses(String(input.interesses ?? ""));

  const allowedStatuses = new Set(["new", "contacted", "scheduled", "closed", "invalid"]);
  const status = allowedStatuses.has(input.status) ? input.status : "new";

  const supabase = await createClient();

  const { error } = await supabase
    .from("leads")
    .update({
      nome_completo: nomeCompleto,
      primeiro_nome: primeiroNome,
      observacoes,
      interesses,
      status,
      nome_validado: Boolean(input.nome_validado),
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  return { ok: true as const };
}
