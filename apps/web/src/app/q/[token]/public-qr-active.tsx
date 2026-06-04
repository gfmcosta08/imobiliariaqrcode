"use client";

import type { QrResolveActive } from "@imobiliariaqrcode/shared-types";
import { useEffect, useMemo, useState, type FormEvent } from "react";

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
  const [autoStatus, setAutoStatus] = useState<"pending" | "done" | "failed">("pending");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [observation, setObservation] = useState("");
  const [submitStatus, setSubmitStatus] = useState<"idle" | "submitting" | "success" | "error">(
    "idle",
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { listing, whatsapp_link: whatsappLink, public_id: publicId } = body;
  const priceStr = formatPrice(listing.price);
  const headline = listing.title?.trim() || publicId;

  const targetLink = useMemo(() => whatsappLink ?? null, [whatsappLink]);

  useEffect(() => {
    if (!targetLink) return;
    setAutoStatus("pending");
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

  async function handleLeadSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitStatus === "submitting") return;
    setSubmitStatus("submitting");
    setSubmitError(null);

    try {
      const res = await fetch("/api/public/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          qr_token: token,
          client_phone: phone,
          nome: name,
          observation,
          intent: "visit_interest",
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || data.ok !== true) {
        const message =
          data.error === "invalid_phone"
            ? "Informe um WhatsApp valido para o corretor retornar."
            : data.error === "missing_token" || data.error === "qr_unavailable"
              ? "Este QR nao esta disponivel para registrar interesse."
              : "Nao foi possivel registrar seu interesse agora.";
        setSubmitError(message);
        setSubmitStatus("error");
        return;
      }
      setSubmitStatus("success");
    } catch {
      setSubmitError("Erro de conexao.");
      setSubmitStatus("error");
    }
  }

  return (
    <div className="min-h-screen bg-white">
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

        {targetLink ? (
          <>
            <p className="text-sm text-gray-600">Abrindo o atendimento via WhatsApp...</p>
            <a
              href={targetLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 flex w-full items-center justify-center bg-black px-4 py-4 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              Abrir WhatsApp
            </a>
          </>
        ) : (
          <form onSubmit={handleLeadSubmit} className="space-y-4" data-testid="public-qr-lead-form">
            <div>
              <label htmlFor="public-qr-name" className="text-xs font-medium text-gray-500">
                Nome
              </label>
              <input
                id="public-qr-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                className="mt-1 w-full border border-gray-300 px-3 py-3 text-sm"
                placeholder="Seu nome"
                data-testid="public-qr-lead-name"
              />
            </div>
            <div>
              <label htmlFor="public-qr-phone" className="text-xs font-medium text-gray-500">
                WhatsApp
              </label>
              <input
                id="public-qr-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={32}
                className="mt-1 w-full border border-gray-300 px-3 py-3 text-sm"
                placeholder="(11) 99999-9999"
                required
                data-testid="public-qr-lead-phone"
              />
            </div>
            <div>
              <label htmlFor="public-qr-observation" className="text-xs font-medium text-gray-500">
                Mensagem
              </label>
              <textarea
                id="public-qr-observation"
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                maxLength={500}
                rows={3}
                className="mt-1 w-full border border-gray-300 px-3 py-3 text-sm"
                placeholder="Quero mais informacoes sobre este imovel."
                data-testid="public-qr-lead-observation"
              />
            </div>
            <button
              type="submit"
              disabled={submitStatus === "submitting" || submitStatus === "success"}
              className="flex w-full items-center justify-center bg-black px-4 py-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
              data-testid="public-qr-lead-submit"
            >
              {submitStatus === "submitting" ? "Enviando..." : "Tenho interesse"}
            </button>
            {submitStatus === "success" ? (
              <p className="text-sm text-green-700" role="status">
                Interesse registrado. O corretor podera ver seu contato.
              </p>
            ) : null}
            {submitError ? (
              <p className="text-sm text-red-600" role="alert">
                {submitError}
              </p>
            ) : null}
          </form>
        )}

        {targetLink && autoStatus === "pending" ? (
          <p className="mt-3 text-center text-xs text-gray-400">
            Se nao abrir automaticamente, toque no botao acima.
          </p>
        ) : null}
        {targetLink && autoStatus === "failed" ? (
          <p className="mt-3 text-center text-xs text-red-500">
            Nao foi possivel abrir automaticamente neste navegador.
          </p>
        ) : null}

        <p className="mt-10 text-center text-xs text-gray-400">Ref. {publicId}</p>
      </div>
    </div>
  );
}
