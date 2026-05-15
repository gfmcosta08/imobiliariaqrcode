import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { InvitationGenerator } from "./invitation-generator";
import { PendingInvitationsList } from "./pending-invitations-list";
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
    .select(
      "id, login_code, status, generated_at, expires_at, claimed_at, completed_at, property_count, expiration_days_configured",
    )
    .order("generated_at", { ascending: false })
    .limit(50);

  return (
    <div className="min-h-screen bg-white">
      <AppHeader active="/admin" isAdmin />
      <main className="mx-auto max-w-6xl px-8 py-12 space-y-16">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Painel Admin</h1>
          <p className="mt-1 text-sm text-gray-500">Gerencie planos, assinaturas, anuncios e convites.</p>
        </div>

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

        <section>
          <h2 className="text-lg font-bold text-gray-900">Assinaturas</h2>
          <p className="mt-1 text-sm text-gray-500">
            Busque, filtre e edite manualmente a validade e o status de qualquer assinatura.
          </p>
          <div className="mt-6">
            <SubscriptionsManager />
          </div>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900">Anuncios</h2>
          <p className="mt-1 text-sm text-gray-500">
            Busque um anuncio por codigo (IMV-...) ou titulo e edite validade e status.
            Reativar um anuncio reativa o QR Code automaticamente.
          </p>
          <div className="mt-6">
            <PropertiesManager />
          </div>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900">Convites cortesia</h2>
          <p className="mt-1 text-sm text-gray-500">
            Gere credenciais de acesso para corretores com imoveis e QR Codes pre-criados.
          </p>

          <InvitationGenerator />

          <PendingInvitationsList
            initialInvitations={(invitations ?? []).map((inv) => ({
              id: String(inv.id),
              login_code: String(inv.login_code),
              status: String(inv.status),
              generated_at: String(inv.generated_at),
              expires_at: inv.expires_at ? String(inv.expires_at) : null,
              claimed_at: inv.claimed_at ? String(inv.claimed_at) : null,
              completed_at: inv.completed_at ? String(inv.completed_at) : null,
              property_count: Number(inv.property_count ?? 1),
              expiration_days_configured: Number(inv.expiration_days_configured ?? 30),
            }))}
          />
        </section>
      </main>
    </div>
  );
}
