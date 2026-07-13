"use client";

import type { QrResolveActive } from "@imobiliariaqrcode/shared-types";

function formatPrice(value: number | null): string | null {
  if (value == null || Number.isNaN(value)) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function purposeLabel(purpose: string | null): string {
  if (purpose === "sale") return "Venda";
  if (purpose === "rent") return "Aluguel";
  if (purpose === "season") return "Temporada";
  return purpose ?? "-";
}

type Props = {
  token: string;
  body: QrResolveActive;
};

export function PublicQrActive({ token, body }: Props) {
  const { listing, whatsapp_link: whatsappLink, public_id: publicId } = body;
  const priceStr = formatPrice(listing.price);
  const headline = listing.title?.trim() || publicId;

  return (
    <div className="min-h-screen bg-white" data-qr-token={token}>
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <span className="text-xs font-bold uppercase tracking-widest text-gray-900">ImoveisQR</span>
      </header>

      <div className="mx-auto max-w-lg px-6 py-10">
        <span className="inline-block bg-black px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
          {purposeLabel(listing.purpose)}
        </span>

        <h1 className="mt-4 text-3xl font-bold leading-tight text-gray-900">{headline}</h1>

        <p className="mt-2 text-sm text-gray-500">
          {[listing.city, listing.state].filter(Boolean).join(", ")}
        </p>

        {priceStr ? <p className="mt-4 text-2xl font-bold text-gray-900">{priceStr}</p> : null}

        <div className="my-6 border-t border-gray-200" />

        {whatsappLink ? (
          <>
            <p className="text-sm text-gray-600">Atendimento via WhatsApp disponivel.</p>
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="public-qr-whatsapp-link"
              className="mt-5 flex w-full items-center justify-center bg-black px-4 py-4 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              Abrir WhatsApp
            </a>
            <p className="mt-4 text-sm text-gray-600">
              O corretor recebe o contexto do imovel e pode continuar o atendimento dali.
            </p>
          </>
        ) : (
          <p
            className="text-sm font-medium text-gray-900"
            data-testid="public-qr-whatsapp-unavailable"
          >
            Atendimento via WhatsApp indisponivel no momento.
          </p>
        )}

        <p className="mt-10 text-center text-xs text-gray-400">Ref. {publicId}</p>
      </div>
    </div>
  );
}
