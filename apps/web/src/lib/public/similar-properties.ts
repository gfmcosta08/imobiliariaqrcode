import type { SupabaseClient } from "@supabase/supabase-js";

export type SimilarPropertyCard = {
  property_id: string;
  public_id: string;
  qr_token: string | null;
  title: string | null;
  city: string | null;
  state: string | null;
  purpose: string | null;
  price: number | null;
  score: number;
};

/**
 * Carrega cartões para UI a partir da RPC `recommend_similar_properties` (ordem preservada).
 */
export async function loadSimilarPropertyCards(
  supabase: SupabaseClient,
  originPropertyId: string,
  limit = 5,
): Promise<SimilarPropertyCard[]> {
  const { data: ranked, error } = await supabase.rpc("recommend_similar_properties", {
    origin_property_id: originPropertyId,
    limit_count: limit,
  });
  if (error || !ranked?.length) {
    return [];
  }

  const rows = ranked as { id: string; score: number }[];
  const ids = rows.map((r) => r.id);
  const scoreById = new Map(rows.map((r) => [r.id, Number(r.score)]));

  const { data: props } = await supabase
    .from("properties")
    .select("id, public_id, title, city, state, purpose, price")
    .in("id", ids);

  const { data: qrs } = await supabase
    .from("property_qrcodes")
    .select("property_id, qr_token")
    .in("property_id", ids)
    .eq("is_active", true);

  const tokenByProp = new Map(
    (qrs ?? []).map((q: { property_id: string; qr_token: string }) => [q.property_id, q.qr_token]),
  );
  const propById = new Map((props ?? []).map((p) => [p.id, p]));

  const out: SimilarPropertyCard[] = [];
  for (const id of ids) {
    const p = propById.get(id);
    if (!p) {
      continue;
    }
    out.push({
      property_id: p.id,
      public_id: p.public_id,
      qr_token: tokenByProp.get(p.id) ?? null,
      title: p.title,
      city: p.city,
      state: p.state,
      purpose: p.purpose,
      price: p.price != null ? Number(p.price) : null,
      score: scoreById.get(id) ?? 0,
    });
  }
  return out;
}
