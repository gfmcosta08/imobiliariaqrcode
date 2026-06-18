import type { SupabaseClient, User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

export type AccountContextError = "unauthenticated" | "account_not_found";

export type AccountContext =
  | {
      supabase: SupabaseClient;
      user: User;
      accountId: string;
      error: null;
    }
  | {
      supabase: SupabaseClient;
      user: User | null;
      accountId: null;
      error: AccountContextError;
    };

export async function resolveCurrentAccountContext(): Promise<AccountContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, accountId: null, error: "unauthenticated" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.account_id) {
    return { supabase, user, accountId: null, error: "account_not_found" };
  }

  return {
    supabase,
    user,
    accountId: profile.account_id as string,
    error: null,
  };
}
