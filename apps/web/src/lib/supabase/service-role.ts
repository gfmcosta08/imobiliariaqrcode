import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente com service role — apenas em rotas/API/server onde variáveis de ambiente são seguras.
 */
export function createServiceRoleClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
