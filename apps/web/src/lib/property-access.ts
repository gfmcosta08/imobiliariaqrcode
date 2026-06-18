import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveCurrentAccountContext } from "@/lib/account-context";

type OwnedPropertyAccess =
  | { supabase: SupabaseClient; accountId: string; error: null }
  | { supabase: SupabaseClient | null; accountId: null; error: string };

export async function assertOwnedPropertyAccess(propertyId: string): Promise<OwnedPropertyAccess> {
  const trimmedId = propertyId.trim();
  if (!trimmedId) {
    return { supabase: null, accountId: null, error: "Imovel invalido." };
  }

  const ctx = await resolveCurrentAccountContext();
  if (ctx.error === "unauthenticated") {
    return { supabase: ctx.supabase, accountId: null, error: "Sessao expirada. Faca login novamente." };
  }
  if (ctx.error || !ctx.accountId) {
    return { supabase: ctx.supabase, accountId: null, error: "Perfil nao encontrado." };
  }

  const { data: property, error } = await ctx.supabase
    .from("properties")
    .select("id")
    .eq("id", trimmedId)
    .eq("account_id", ctx.accountId)
    .maybeSingle();

  if (error || !property) {
    return { supabase: ctx.supabase, accountId: null, error: "Imovel nao encontrado." };
  }

  return { supabase: ctx.supabase, accountId: ctx.accountId, error: null };
}
