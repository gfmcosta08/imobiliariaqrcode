import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createClient } from "@/lib/supabase/server";

export async function getAdminContext() {
  const userClient = await createClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();

  if (!user) {
    return { ok: false as const, status: 401, error: "unauthorized" };
  }

  const supabase = createServiceRoleClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return { ok: false as const, status: 500, error: error.message };
  }

  if (profile?.role !== "admin") {
    return { ok: false as const, status: 403, error: "forbidden" };
  }

  return { ok: true as const, userId: user.id, supabase };
}
