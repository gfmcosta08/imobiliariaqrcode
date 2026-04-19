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
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <div className="mx-auto flex max-w-lg flex-col px-6 py-12">
        {/* Badge de finalidade */}
        <span className="inline-flex w-fit items-center bg-zinc-900 px-3 py-1 text-xs font-medium uppercase tracking-widest text-white dark:bg-zinc-100 dark:text-zinc-900">
          {purposeLabel(listing.purpose)}
        </span>

        {/* Headline */}
        <h1 className="font-display mt-5 text-3xl font-normal leading-tight text-zinc-900 dark:text-zinc-50">
          {headline}
        </h1>

        {/* Localização */}
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {[listing.city, listing.state].filter(Boolean).join(" · ")}
        </p>

        {/* Preço */}
        {priceStr ? (
          <p className="mt-4 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
            {priceStr}
          </p>
        ) : null}

        {/* Card de ação */}
        <div className="mt-8 border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Abrindo o atendimento via WhatsApp...
          </p>

          {targetLink ? (
            <a
              href={targetLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex w-full items-center justify-center bg-zinc-900 px-4 py-3.5 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Abrir WhatsApp
            </a>
          ) : (
            <p className="mt-3 text-sm text-red-600">Número do bot não configurado.</p>
          )}

          {autoStatus === "pending" ? (
            <p className="mt-3 text-xs text-zinc-400">
              Se não abrir automaticamente, toque no botão acima.
            </p>
          ) : null}
          {autoStatus === "failed" ? (
            <p className="mt-3 text-xs text-red-500">
              Não foi possível abrir automaticamente neste navegador.
            </p>
          ) : null}
        </div>

        <p className="mt-10 text-center text-xs text-zinc-400">Ref. {publicId}</p>
      </div>
    </div>
  );
}
