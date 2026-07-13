"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type UpdateProfileState = { error?: string; success?: string } | null;

export async function updateProfile(
  _prev: UpdateProfileState,
  formData: FormData,
): Promise<UpdateProfileState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sessao invalida. Faca login novamente." };
  }

  const full_name = String(formData.get("full_name") ?? "").trim();
  const whatsapp_number = String(formData.get("whatsapp_number") ?? "").trim();

  if (!full_name || !whatsapp_number) {
    return { error: "Nome e WhatsApp sao obrigatorios." };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ full_name, whatsapp_number })
    .eq("id", user.id);

  if (profileError) {
    return { error: profileError.message };
  }

  const { error: brokerError } = await supabase
    .from("brokers")
    .update({ display_name: full_name, whatsapp_number })
    .eq("profile_id", user.id);

  if (brokerError) {
    return { error: brokerError.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/profile");
  return { success: "Perfil atualizado com sucesso." };
}
