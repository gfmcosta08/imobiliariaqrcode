import Link from "next/link";
import { PartnerPortal } from "./partner-portal";

export default function PartnerPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Portal parceiro</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Busca por <code className="text-xs">public_id</code> (ex.: IMV-2026-ABC123). Exige perfil
        vinculado em <code className="text-xs">partner_users</code>.
      </p>
      <PartnerPortal />
      <p className="mt-8 text-sm">
        <Link href="/" className="text-zinc-600 underline dark:text-zinc-400">
          Início
        </Link>
      </p>
    </div>
  );
}
