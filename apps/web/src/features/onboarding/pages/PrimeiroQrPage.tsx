import Link from "next/link";

import { AppHeader } from "@/components/app-header";
import { createClient } from "@/lib/supabase/server";

import { QuickPropertyForm } from "../components/QuickPropertyForm";

export default async function PrimeiroQrOnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("whatsapp_number")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  const needsWhatsapp =
    !profile?.whatsapp_number || String(profile.whatsapp_number).startsWith("pending-");

  return (
    <div className="min-h-screen bg-white">
      <AppHeader active="/properties" />
      <main className="mx-auto max-w-3xl px-8 py-12">
        <h1 className="text-3xl font-bold text-gray-900">Criar meu primeiro QR</h1>
        <p className="mt-2 text-sm text-gray-600">
          Cadastro rapido: imovel minimo, QR visivel e teste de WhatsApp em poucos minutos.
        </p>
        <QuickPropertyForm needsWhatsapp={needsWhatsapp} />
        <p className="mt-6 text-sm text-gray-500">
          Prefere o formulario completo?{" "}
          <Link href="/properties/new" className="font-medium text-black underline">
            Cadastrar imovel completo
          </Link>
        </p>
      </main>
    </div>
  );
}
