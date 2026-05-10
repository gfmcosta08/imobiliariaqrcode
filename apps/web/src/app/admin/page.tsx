import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { InvitationGenerator } from "./invitation-generator";
import { PlansEditor } from "./plans-editor";
import { SubscriptionsManager } from "./subscriptions-manager";
import { PropertiesManager } from "./properties-manager";

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
    .select("id, login_code, status, generated_at, claimed_at, property_count, expiration_days_configured")
    .order("generated_at", { ascending: false })
    .limit(20);

  return (
    <div className="min-h-screen bg-white">
      <AppHeader active="/admin" isAdmin />
      <main className="mx-auto max-w-6xl px-8 py-12 space-y-16">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Painel Admin</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gerencie planos, assinaturas, anúncios e convites.
          </p>
        </div>

        {/* Planos */}
        <section>
          <h2 className="text-lg font-bold text-gray-900">Planos</h2>
          <p className="mt-1 text-sm text-gray-500">
            Edite em uma unica tela o conteudo publico e as variaveis tecnicas de cada plano.
            O preco exibido nao altera o valor cobrado pelo Stripe.
          </p>
          <div className="mt-6">
            <PlansEditor />
          </div>
        </section>
        {/* Assinaturas */}
        <section>
          <h2 className="text-lg font-bold text-gray-900">Assinaturas</h2>
          <p className="mt-1 text-sm text-gray-500">
            Busque, filtre e edite manualmente a validade e o status de qualquer assinatura.
          </p>
          <div className="mt-6">
            <SubscriptionsManager />
          </div>
        </section>

        {/* Anúncios */}
        <section>
          <h2 className="text-lg font-bold text-gray-900">Anúncios</h2>
          <p className="mt-1 text-sm text-gray-500">
            Busque um anúncio por código (IMV-…) ou título e edite validade e status.
            Reativar um anúncio reativa o QR Code automaticamente.
          </p>
          <div className="mt-6">
            <PropertiesManager />
          </div>
        </section>

        {/* Convites */}
        <section>
          <h2 className="text-lg font-bold text-gray-900">Convites cortesia</h2>
          <p className="mt-1 text-sm text-gray-500">
            Gere credenciais de acesso para corretores com imóveis e QR Codes pré-criados.
          </p>

          <InvitationGenerator />

          <div className="mt-12 border border-gray-200 p-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">
              Convites gerados
            </h3>

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
                      <span className="ml-3 text-xs text-gray-400">
                        {(inv.property_count as number) ?? 1} imóvel(is) ·{" "}
                        {(inv.expiration_days_configured as number) ?? 30} dias
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
        </section>
      </main>
    </div>
  );
}
