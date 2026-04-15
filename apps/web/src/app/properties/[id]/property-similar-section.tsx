import Link from "next/link";

import {
  loadSimilarPropertyCards,
  type SimilarPropertyCard,
} from "@/lib/public/similar-properties";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

function formatPrice(value: number | null): string | null {
  if (value == null || Number.isNaN(value)) {
    return null;
  }
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export async function PropertySimilarSection({ propertyId }: { propertyId: string }) {
  let items: SimilarPropertyCard[] = [];
  try {
    const sb = createServiceRoleClient();
    items = await loadSimilarPropertyCards(sb, propertyId, 5);
  } catch {
    return null;
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="mt-10">
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Imóveis similares</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Sugestões do mesmo corretor (regras FREE/PRO do banco).
      </p>
      <ul className="mt-4 space-y-3">
        {items.map((s) => {
          const pStr = formatPrice(s.price);
          const label = s.title?.trim() || s.public_id;
          return (
            <li
              key={s.property_id}
              className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <Link
                href={`/properties/${s.property_id}`}
                className="block text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
              >
                {label}
              </Link>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                {[s.city, s.state].filter(Boolean).join(" / ")}
                {pStr ? ` · ${pStr}` : ""}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
