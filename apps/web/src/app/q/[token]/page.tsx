import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { chooseWhatsappRedirect } from "@/lib/public/whatsapp-link";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { PublicQrClient } from "./public-qr-client";

type PageProps = { params: Promise<{ token: string }> };

type QrResolvePayload = Record<string, unknown>;

function numeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

async function resolveQrFromDatabase(token: string): Promise<QrResolvePayload | null> {
  const supabase = createServiceRoleClient();
  const { data: row, error } = await supabase
    .from("property_qrcodes")
    .select(
      `
      qr_token,
      is_active,
      properties (
        id,
        public_id,
        listing_status,
        expires_at,
        broker_id,
        title,
        city,
        state,
        purpose,
        price,
        sale_price,
        rent_price
      )
    `,
    )
    .eq("qr_token", token)
    .maybeSingle();

  if (error) {
    console.error("qr database fallback failed", {
      tokenPrefix: token.slice(0, 8),
      detail: error.message,
    });
    return null;
  }

  const nested = row?.properties as
    | Record<string, unknown>
    | Record<string, unknown>[]
    | null
    | undefined;
  const property = Array.isArray(nested) ? nested[0] : nested;

  if (!row || !property) return { ok: true, state: "not_found" };

  const listingStatus = String(property.listing_status ?? "");
  const expiresAt = property.expires_at ? new Date(String(property.expires_at)) : null;
  if (!row.is_active || listingStatus === "removed" || listingStatus === "blocked") {
    return { ok: true, state: "unavailable", message: "Este anuncio nao esta mais disponivel." };
  }
  if (listingStatus === "expired" || (expiresAt && expiresAt < new Date())) {
    return { ok: true, state: "expired", message: "Este anuncio nao esta mais disponivel." };
  }

  const brokerId = typeof property.broker_id === "string" ? property.broker_id : "";
  const { data: broker } = brokerId
    ? await supabase.from("brokers").select("whatsapp_number").eq("id", brokerId).maybeSingle()
    : { data: null };
  const targetPhone =
    process.env.UAZAPI_BOT_PHONE ??
    process.env.WHATSAPP_BOT_PHONE ??
    broker?.whatsapp_number ??
    null;
  const publicId = typeof property.public_id === "string" ? property.public_id : "";
  const leadStartText = encodeURIComponent(
    `Ola! Tenho interesse no imovel ${publicId} que vi no ImoveisQR`,
  );
  const whatsappLink = targetPhone
    ? `https://wa.me/${String(targetPhone).replace(/\D/g, "")}?text=${leadStartText}`
    : null;
  const price =
    numeric(property.price) ?? numeric(property.sale_price) ?? numeric(property.rent_price);

  return {
    ok: true,
    state: "active",
    property_id: property.id,
    public_id: publicId,
    broker_id: brokerId,
    broker_whatsapp: broker?.whatsapp_number ?? null,
    whatsapp_link: whatsappLink,
    listing: {
      title: property.title ?? null,
      city: property.city ?? null,
      state: property.state ?? null,
      purpose: property.purpose ?? null,
      price,
    },
  };
}

export default async function PublicQrPage(props: PageProps) {
  const { token } = await props.params;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");

  if (!base) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
        <p className="text-sm text-red-600">
          NEXT_PUBLIC_SUPABASE_URL nao configurada no ambiente.
        </p>
      </div>
    );
  }

  let initial: unknown = null;
  let fetchError: string | null = null;

  try {
    const res = await fetch(`${base}/functions/v1/qr-resolve?token=${encodeURIComponent(token)}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    const bodyText = await res.text();
    let parsed: unknown = null;
    try {
      parsed = bodyText ? (JSON.parse(bodyText) as unknown) : null;
    } catch {
      parsed = null;
    }

    if (!res.ok) {
      fetchError = `Falha ao validar QR (HTTP ${res.status}).`;
      console.error("qr-resolve non-ok response", {
        status: res.status,
        statusText: res.statusText,
        tokenPrefix: token.slice(0, 8),
        bodyPreview: bodyText.slice(0, 180),
      });
    } else if (!parsed || typeof parsed !== "object") {
      fetchError = "Resposta invalida ao validar QR.";
      console.error("qr-resolve invalid json response", {
        tokenPrefix: token.slice(0, 8),
        bodyPreview: bodyText.slice(0, 180),
      });
    } else {
      const payload = parsed as Record<string, unknown>;
      const isActive = payload.ok === true && payload.state === "active";
      if (isActive && typeof payload.property_id !== "string") {
        console.error("qr-resolve active payload missing property_id", {
          tokenPrefix: token.slice(0, 8),
          keys: Object.keys(payload),
          state: payload.state,
          ok: payload.ok,
        });
      }
      initial = parsed;
    }
  } catch (e) {
    fetchError = "Erro de rede ao validar QR.";
    console.error("qr-resolve fetch failed", {
      tokenPrefix: token.slice(0, 8),
      error: e instanceof Error ? e.message : String(e),
    });
  }

  if (fetchError) {
    const fallback = await resolveQrFromDatabase(token);
    if (fallback) {
      console.warn("qr-resolve fallback used", {
        tokenPrefix: token.slice(0, 8),
        originalError: fetchError,
      });
      fetchError = null;
      initial = fallback;
    }
  }

  const body = initial && typeof initial === "object" ? (initial as Record<string, unknown>) : null;
  const ok = body?.ok === true;
  const state = typeof body?.state === "string" ? body.state : null;
  const whatsappLink = typeof body?.whatsapp_link === "string" ? body.whatsapp_link : null;
  const whatsappDeepLink =
    typeof body?.whatsapp_deeplink === "string" ? body.whatsapp_deeplink : null;

  if (!fetchError && ok && state === "active") {
    const userAgent = (await headers()).get("user-agent");
    const destination = chooseWhatsappRedirect(whatsappLink, whatsappDeepLink, userAgent);
    if (destination) {
      redirect(destination);
    }
  }

  return <PublicQrClient token={token} initial={initial} fetchError={fetchError} />;
}
