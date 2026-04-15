import { PropertyForm } from "./property-form";

export default function NewPropertyPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Novo imóvel</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Corretor e conta vêm da sessão; limites FREE/PRO são aplicados no Postgres.
      </p>
      <PropertyForm />
    </div>
  );
}
