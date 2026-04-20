"use client";

import type { QrResolveActive } from "@imobiliariaqrcode/shared-types";
import { useMemo } from "react";

import { PublicQrActive } from "./public-qr-active";

type Props = {
  token: string;
  initial: unknown;
  fetchError: string | null;
};

function toActiveBody(b: Record<string, unknown>): QrResolveActive | null {
  if (b.ok !== true) return null;

  const brokerRaw =
    b.broker && typeof b.broker === "object" ? (b.broker as Record<string, unknown>) : null;
  const legacyPropertyRaw =
    b.property && typeof b.property === "object" ? (b.property as Record<string, unknown>) : null;

  if (b.state === "active") {
    const propertyId =
      typeof b.property_id === "string" ? b.property_id : typeof b.id === "string" ? b.id : null;
    if (!propertyId) return null;

    const listingRaw = b.listing;
    const listing =
      listingRaw && typeof listingRaw === "object" ? (listingRaw as Record<string, unknown>) : {};

    return {
      ok: true,
      state: "active",
      property_id: propertyId,
      public_id: typeof b.public_id === "string" ? b.public_id : propertyId,
      broker_id: typeof b.broker_id === "string" ? b.broker_id : "",
      broker_whatsapp:
        typeof b.broker_whatsapp === "string"
          ? b.broker_whatsapp
          : typeof brokerRaw?.whatsapp_number === "string"
            ? brokerRaw.whatsapp_number
            : null,
      whatsapp_link: typeof b.whatsapp_link === "string" ? b.whatsapp_link : null,
      listing: {
        title: typeof listing.title === "string" ? listing.title : null,
        city: typeof listing.city === "string" ? listing.city : null,
        state: typeof listing.state === "string" ? listing.state : null,
        purpose: typeof listing.purpose === "string" ? listing.purpose : null,
        price: typeof listing.price === "number" ? listing.price : null,
      },
    };
  }

  // Compat: contrato legado da edge function (`{ ok, property, broker }`).
  if (legacyPropertyRaw && typeof legacyPropertyRaw.id === "string") {
    const legacyPrice =
      typeof legacyPropertyRaw.price === "number"
        ? legacyPropertyRaw.price
        : typeof legacyPropertyRaw.sale_price === "number"
          ? legacyPropertyRaw.sale_price
          : typeof legacyPropertyRaw.rent_price === "number"
            ? legacyPropertyRaw.rent_price
            : null;

    return {
      ok: true,
      state: "active",
      property_id: legacyPropertyRaw.id,
      public_id:
        typeof legacyPropertyRaw.public_id === "string"
          ? legacyPropertyRaw.public_id
          : legacyPropertyRaw.id,
      broker_id: typeof legacyPropertyRaw.broker_id === "string" ? legacyPropertyRaw.broker_id : "",
      broker_whatsapp:
        typeof brokerRaw?.whatsapp_number === "string" ? brokerRaw.whatsapp_number : null,
      whatsapp_link: typeof b.whatsapp_link === "string" ? b.whatsapp_link : null,
      listing: {
        title: typeof legacyPropertyRaw.title === "string" ? legacyPropertyRaw.title : null,
        city: typeof legacyPropertyRaw.city === "string" ? legacyPropertyRaw.city : null,
        state: typeof legacyPropertyRaw.state === "string" ? legacyPropertyRaw.state : null,
        purpose: typeof legacyPropertyRaw.purpose === "string" ? legacyPropertyRaw.purpose : null,
        price: legacyPrice,
      },
    };
  }

  return null;
}

export function PublicQrClient({ token, initial, fetchError }: Props) {
  const body = useMemo(() => {
    if (fetchError || initial === null || typeof initial !== "object") {
      return null;
    }
    return initial as Record<string, unknown>;
  }, [fetchError, initial]);

  if (fetchError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
        <p className="text-sm text-red-600" role="alert">
          {fetchError}
        </p>
      </div>
    );
  }

  if (!body) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
        <p className="text-sm text-red-600">Resposta invalida do servidor.</p>
      </div>
    );
  }

  const message =
    typeof body.message === "string" ? body.message : "Este anuncio nao esta mais disponivel.";
  const ok = body.ok === true;
  const st = typeof body.state === "string" ? body.state : "unknown";

  if (!ok || st === "not_found") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 text-center dark:bg-zinc-950">
        <p className="text-lg font-medium text-zinc-900 dark:text-zinc-50">QR invalido</p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Nao encontramos este anuncio.
        </p>
      </div>
    );
  }

  if (st === "expired" || st === "unavailable") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 text-center dark:bg-zinc-950">
        <p className="text-lg font-medium text-zinc-900 dark:text-zinc-50">{message}</p>
      </div>
    );
  }

  const activeBody = toActiveBody(body);
  if (!activeBody) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 text-center dark:bg-zinc-950">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Nao foi possivel exibir o anuncio.
        </p>
      </div>
    );
  }

  return <PublicQrActive token={token} body={activeBody} />;
}
