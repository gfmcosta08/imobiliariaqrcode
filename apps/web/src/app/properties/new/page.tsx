import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { PropertyForm } from "./property-form";

export default function NewPropertyPage() {
  return (
    <div className="min-h-screen bg-white">
      <AppHeader active="/properties" />
      <main className="mx-auto max-w-6xl px-8 py-12">
        <p className="text-sm text-gray-400">
          <Link href="/properties" className="transition hover:text-gray-700">
            Imoveis
          </Link>
          {" / "}Novo imovel
        </p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">Novo imovel</h1>
        <p className="mt-1 text-sm text-gray-500">
          Limites do plano ativo sao aplicados automaticamente.
        </p>
        <div className="mt-8">
          <PropertyForm />
        </div>
      </main>
    </div>
  );
}
