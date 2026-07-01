import Link from "next/link";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { createClient } from "@/lib/supabase/server";

import { SubscriberSearchList } from "../components/subscriber-search-list";

type PageProps = {
  searchParams?: Promise<{ q?: string }>;
};

export default async function AdminSubscribersPage(props: PageProps) {
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

  const query = props.searchParams ? await props.searchParams : undefined;
  const initialQuery = query?.q ?? "";

  return (
    <div className="min-h-screen bg-white">
      <AppHeader active="/admin" isAdmin />
      <main className="mx-auto max-w-6xl px-8 py-12">
        <p className="text-sm text-gray-500">
          <Link href="/admin" className="underline">
            Admin
          </Link>{" "}
          / Métricas de assinantes
        </p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">Métricas de assinantes</h1>
        <p className="mt-1 text-sm text-gray-500">
          Busque por nome, e-mail, telefone ou número da conta (UUID).
        </p>
        <div className="mt-8">
          <SubscriberSearchList initialQuery={initialQuery} />
        </div>
      </main>
    </div>
  );
}
