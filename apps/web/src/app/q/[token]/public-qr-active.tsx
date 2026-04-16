"use client";

import type { QrResolveActive } from "@imobiliariaqrcode/shared-types";
import { useEffect, useMemo, useState } from "react";

function formatPrice(value: number | null): string | null {
  if (value == null || Number.isNaN(value)) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function purposeLabel(purpose: string | null): string {
  if (purpose === "sale") return "Venda";
  if (purpose === "rent") return "Aluguel";
  if (purpose === "season") return "Temporada";
  return purpose ?? "—";
}

type Props = {
  token: string;
  body: QrResolveActive;
};

export function PublicQrActive({ body }: Props) {
  const [autoStatus, setAutoStatus] = useState<"pending" | "done" | "failed">("pending");
  const { listing, whatsapp_link: whatsappLink, public_id: publicId } = body;
  const priceStr = formatPrice(listing.price);
  const headline = listing.title?.trim() || publicId;

  const targetLink = useMemo(() => whatsappLink ?? null, [whatsappLink]);

  useEffect(() => {
    if (!targetLink) {
      setAutoStatus("failed");
      return;
    }

    const t = window.setTimeout(() => {
      try {
        window.location.href = targetLink;
        setAutoStatus("done");
      } catch {
        setAutoStatus("failed");
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [targetLink]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900">
      <div className="mx-auto flex max-w-lg flex-col px-4 py-10">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {purposeLabel(listing.purpose)}
          {priceStr ? ` · ${priceStr}` : ""}
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-tight text-zinc-900 dark:text-zinc-50">
          {headline}
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {[listing.city, listing.state].filter(Boolean).join(" / ")}
        </p>

        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            Abrindo o WhatsApp do atendimento...
          </p>
          {targetLink ? (
            <a
              href={targetLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              Abrir WhatsApp agora
            </a>
          ) : (
            <p className="mt-3 text-sm text-red-600">Numero do bot nao configurado.</p>
          )}

          {autoStatus === "pending" ? (
            <p className="mt-3 text-xs text-zinc-500">Se nao abrir automaticamente, toque no botao acima.</p>
          ) : null}
          {autoStatus === "failed" ? (
            <p className="mt-3 text-xs text-red-600">Nao foi possivel abrir automaticamente neste navegador.</p>
          ) : null}
        </div>

        <p className="mt-8 text-center text-xs text-zinc-500">Ref. {publicId}</p>
      </div>
    </div>
  );
}
