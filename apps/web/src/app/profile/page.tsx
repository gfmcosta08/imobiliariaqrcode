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

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, whatsapp_number")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="min-h-screen bg-white">
      <AppHeader active="/profile" />
      <main className="mx-auto max-w-3xl px-8 py-12">
        <p className="text-sm text-gray-400">
          <Link href="/dashboard" className="transition hover:text-gray-700">Painel</Link>
          {" / "}Perfil
        </p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">Editar perfil</h1>
        <p className="mt-1 text-sm text-gray-500">
          Atualize seus dados de contato.
        </p>
        <div className="mt-8 border border-gray-200 p-6">
          <ProfileForm
            fullName={profile?.full_name ?? ""}
            whatsapp={profile?.whatsapp_number ?? ""}
            email={user.email ?? ""}
          />
        </div>
      </main>
    </div>
  );
}
