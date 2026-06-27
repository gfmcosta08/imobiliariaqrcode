import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { chooseWhatsappRedirect } from "@/lib/public/whatsapp-link";
import { PublicQrClient } from "./public-qr-client";

type PageProps = { params: Promise<{ token: string }> };

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
