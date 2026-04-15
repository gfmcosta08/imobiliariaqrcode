"use client";

import type { QrResolveActive } from "@imobiliariaqrcode/shared-types";
import { useMemo } from "react";

import { PublicQrActive } from "./public-qr-active";

type Props = {
  token: string;
  initial: unknown;
  fetchError: string | null;
};

function isQrActive(b: Record<string, unknown>): b is QrResolveActive {
  return (
    b.ok === true &&
    b.state === "active" &&
    typeof b.property_id === "string" &&
    typeof b.public_id === "string" &&
    typeof b.broker_id === "string" &&
    b.listing !== null &&
    typeof b.listing === "object"
  );
}

export function PublicQrClient({ token, initial, fetchError }: Props) {
  const body = useMemo(() => {
    if (fetchError || initial === null || typeof initial !== "object" || initial === null) {
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
        <p className="text-sm text-red-600">Resposta inválida do servidor.</p>
      </div>
    );
  }

  const message =
    typeof body.message === "string" ? body.message : "Este anúncio não está mais disponível.";
  const ok = body.ok === true;
  const st = typeof body.state === "string" ? body.state : "unknown";

  if (!ok || st === "not_found") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 text-center dark:bg-zinc-950">
        <p className="text-lg font-medium text-zinc-900 dark:text-zinc-50">QR inválido</p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Não encontramos este anúncio.
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

  if (!isQrActive(body)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 text-center dark:bg-zinc-950">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Não foi possível exibir o anúncio.
        </p>
      </div>
    );
  }

  return <PublicQrActive token={token} body={body as QrResolveActive} />;
}
