import { AppHeader } from "@/components/app-header";
import { PartnerPortal } from "./partner-portal";

export default function PartnerPage() {
  return (
    <div className="min-h-screen bg-white">
      <AppHeader active="/partner" />
      <main className="mx-auto max-w-3xl px-8 py-12">
        <h1 className="text-3xl font-bold text-gray-900">Portal parceiro</h1>
        <p className="mt-1 text-sm text-gray-500">
          Busque imóveis pelo código de referência (ex.: IMV-2026-ABC123).
        </p>
        <div className="mt-8 border border-gray-200 p-6">
          <PartnerPortal />
        </div>
      </main>
    </div>
  );
}
