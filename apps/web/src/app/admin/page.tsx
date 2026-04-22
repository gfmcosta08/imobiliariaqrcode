import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { InvitationGenerator } from "./invitation-generator";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") redirect("/dashboard");

  const { data: invitations } = await supabase
    .from("broker_invitations")
    .select("id, login_code, status, generated_at, claimed_at, property_id")
    .order("generated_at", { ascending: false })
    .limit(20);

  return (
    <div className="min-h-screen bg-white">
      <AppHeader active="/admin" isAdmin />
      <main className="mx-auto max-w-6xl px-8 py-12">
        <h1 className="text-3xl font-bold text-gray-900">Painel Admin</h1>
        <p className="mt-1 text-sm text-gray-500">Gerencie convites cortesia para corretores.</p>

        <InvitationGenerator />

        <div className="mt-12 border border-gray-200 p-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">
            Convites gerados
          </h2>

          {!invitations?.length ? (
            <p className="mt-4 text-sm text-gray-400">Nenhum convite gerado ainda.</p>
          ) : (
            <ul className="mt-4 divide-y divide-gray-100">
              {invitations.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between py-3">
                  <div>
                    <span className="text-sm font-mono font-semibold text-gray-900">
                      Login: {inv.login_code as string}
                    </span>
                    <span className="ml-4 text-xs text-gray-400">
                      {new Date(inv.generated_at as string).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <span
                    className={`text-xs font-semibold uppercase tracking-wide ${
                      inv.status === "claimed"
                        ? "text-green-600"
                        : inv.status === "expired"
                          ? "text-red-400"
                          : "text-yellow-600"
                    }`}
                  >
                    {inv.status === "claimed"
                      ? "Ativado"
                      : inv.status === "expired"
                        ? "Expirado"
                        : "Pendente"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
