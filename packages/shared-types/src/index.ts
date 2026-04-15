/**
 * Tipos compartilhados entre apps e Edge Functions.
 * Alinhar com o contrato JSON das Edge Functions quando mudar o schema.
 */
export type PlanCode = "free" | "pro";

/** Resposta `qr-resolve` quando o anúncio está ativo (campos principais). */
export type QrResolveListing = {
  title: string | null;
  city: string | null;
  state: string | null;
  purpose: string | null;
  price: number | null;
};

export type QrResolveActive = {
  ok: true;
  state: "active";
  property_id: string;
  public_id: string;
  broker_id: string;
  broker_whatsapp: string | null;
  whatsapp_link: string | null;
  listing: QrResolveListing;
};
