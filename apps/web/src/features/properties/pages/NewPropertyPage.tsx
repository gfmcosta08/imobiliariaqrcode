import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { isPropertyImportEnabled } from "../lib/property-import/enabled";
import { ImportListingsButton } from "../components/ImportListingsButton";
import { PropertyForm } from "../components/PropertyForm";

export default function NewPropertyPage() {
  const importEnabled = isPropertyImportEnabled();
  return (
    <div className="min-h-screen bg-white">
      <AppHeader active="/properties" />
      <main className="mx-auto max-w-6xl px-8 py-12">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <p className="text-sm text-gray-400">
              <Link href="/properties" className="transition hover:text-gray-700">
                Imóveis
              </Link>
              {" / "}Novo imóvel
            </p>
            <h1 className="mt-2 text-3xl font-bold text-gray-900">Novo imóvel</h1>
            <p className="mt-1 text-sm text-gray-500">
              Limites FREE/PRO são aplicados automaticamente.{" "}
              <Link href="/onboarding/primeiro-qr" className="font-medium text-black underline">
                Cadastro rapido do primeiro QR
              </Link>
            </p>
          </div>
          <div className="shrink-0">
            <ImportListingsButton enabled={importEnabled} />
          </div>
        </div>
        <div className="mt-8">
          <PropertyForm />
        </div>
      </main>
    </div>
  );
}
