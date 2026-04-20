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
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <span className="text-xs font-bold uppercase tracking-widest text-gray-900">IMOBQR</span>
      </header>

      <div className="mx-auto max-w-lg px-6 py-10">
        {/* Badge finalidade */}
        <span className="inline-block bg-black px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
          {purposeLabel(listing.purpose)}
        </span>

        {/* Título */}
        <h1 className="mt-4 text-3xl font-bold leading-tight text-gray-900">{headline}</h1>

        {/* Localização */}
        <p className="mt-2 text-sm text-gray-500">
          {[listing.city, listing.state].filter(Boolean).join(", ")}
        </p>

        {/* Preço */}
        {priceStr ? (
          <p className="mt-4 text-2xl font-bold text-gray-900">{priceStr}</p>
        ) : null}

        {/* Separador */}
        <div className="my-6 border-t border-gray-200" />

        {/* Card de ação */}
        <p className="text-sm text-gray-600">Abrindo o atendimento via WhatsApp...</p>

        {targetLink ? (
          <a
            href={targetLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 flex w-full items-center justify-center bg-black px-4 py-4 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            Abrir WhatsApp
          </a>
        ) : (
          <p className="mt-3 text-sm text-red-600">Número do bot não configurado.</p>
        )}

        {autoStatus === "pending" ? (
          <p className="mt-3 text-center text-xs text-gray-400">
            Se não abrir automaticamente, toque no botão acima.
          </p>
        ) : null}
        {autoStatus === "failed" ? (
          <p className="mt-3 text-center text-xs text-red-500">
            Não foi possível abrir automaticamente neste navegador.
          </p>
        ) : null}

        <p className="mt-10 text-center text-xs text-gray-400">Ref. {publicId}</p>
      </div>
    </div>
  );
}
