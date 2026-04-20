import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";

import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profile }, { data: subscription }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, whatsapp_number, role")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("subscriptions").select("plan_code, status, updated_at").maybeSingle(),
  ]);

  return (
    <div className="min-h-screen bg-white">
      <AppHeader active="/profile" />
      <main className="mx-auto max-w-3xl px-8 py-12">
        <p className="text-sm text-gray-400">
          <Link href="/dashboard" className="transition hover:text-gray-700">
            Painel
          </Link>
          {" / "}Perfil
        </p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">Meu perfil</h1>
        <p className="mt-1 text-sm text-gray-500">Gerencie seus dados de acesso e contato.</p>

        {/* Info da conta */}
        <div className="mt-8 border border-gray-200 p-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Conta</h2>
          <dl className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-gray-400">E-mail</dt>
              <dd className="mt-1 text-sm font-medium text-gray-900">{user.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">Perfil</dt>
              <dd className="mt-1 text-sm font-medium text-gray-900">
                {profile?.role ?? "corretor"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">Membro desde</dt>
              <dd className="mt-1 text-sm font-medium text-gray-900">
                {user.created_at ? new Date(user.created_at).toLocaleDateString("pt-BR") : "—"}
              </dd>
            </div>
          </dl>
        </div>

        {/* Plano */}
        <div className="mt-4 border border-gray-200 p-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Plano</h2>
          <dl className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-gray-400">Plano atual</dt>
              <dd className="mt-1 text-sm font-medium text-gray-900">
                {(subscription?.plan_code ?? "free").toUpperCase()}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">Status</dt>
              <dd className="mt-1 text-sm font-medium text-gray-900">
                {subscription?.status ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">Atualizado em</dt>
              <dd className="mt-1 text-sm font-medium text-gray-900">
                {subscription?.updated_at
                  ? new Date(subscription.updated_at).toLocaleDateString("pt-BR")
                  : "—"}
              </dd>
            </div>
          </dl>
          <Link
            href="/plans"
            className="mt-5 inline-block border border-gray-300 px-5 py-2.5 text-sm text-gray-700 transition hover:border-gray-500"
          >
            Ver planos →
          </Link>
        </div>

        {/* Editar dados de contato */}
        <div className="mt-4 border border-gray-200 p-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">
            Dados de contato
          </h2>
          <div className="mt-5">
            <ProfileForm
              fullName={profile?.full_name ?? ""}
              whatsapp={profile?.whatsapp_number ?? ""}
              email={user.email ?? ""}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
