import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, whatsapp_number")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-sm text-zinc-500">
        <Link href="/dashboard" className="underline">
          Painel
        </Link>{" "}
        / Perfil
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Editar perfil</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Atualize seus dados de contato para aparecerem corretamente no sistema.
      </p>

      <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <ProfileForm
          fullName={profile?.full_name ?? ""}
          whatsapp={profile?.whatsapp_number ?? ""}
          email={user.email ?? ""}
        />
      </div>
    </div>
  );
}
