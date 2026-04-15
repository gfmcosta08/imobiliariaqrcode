"use client";

import type { QrResolveActive } from "@imobiliariaqrcode/shared-types";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import type { SimilarPropertyCard } from "@/lib/public/similar-properties";

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

function isYes(value: string): boolean {
  return /^(sim|s|yes|y|1|quero)$/i.test(value.trim());
}

export function PublicQrActive({ token, body }: Props) {
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [leadOk, setLeadOk] = useState(false);
  const [similar, setSimilar] = useState<SimilarPropertyCard[] | null>(null);
  const [wantVisit, setWantVisit] = useState("");
  const [wantSimilar, setWantSimilar] = useState("");

  const { listing, whatsapp_link: whatsappLink, public_id: publicId } = body;
  const priceStr = formatPrice(listing.price);
  const headline = listing.title?.trim() || publicId;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/public/similar?token=${encodeURIComponent(token)}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as { ok?: boolean; items?: SimilarPropertyCard[] };
        if (!cancelled && data.ok && Array.isArray(data.items)) {
          setSimilar(data.items);
        }
      } catch {
        if (!cancelled) setSimilar([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      const intent = isYes(wantVisit)
        ? "visit_interest"
        : isYes(wantSimilar)
          ? "similar_property_interest"
          : "visit_interest";
      const res = await fetch("/api/public/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qr_token: token,
          client_phone: phone,
          intent,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setSubmitError(
          data.error === "invalid_phone"
            ? "Informe um telefone válido com DDD."
            : data.error === "qr_unavailable"
              ? "Este anúncio não está mais disponível."
              : (data.error ?? "Não foi possível registrar."),
        );
        return;
      }
      setLeadOk(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Erro de rede.");
    } finally {
      setSubmitting(false);
    }
  }

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

        <div className="mt-4">
          {whatsappLink ? (
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              Falar no WhatsApp
            </a>
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              WhatsApp do corretor não configurado para este anúncio.
            </p>
          )}
        </div>

        <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {leadOk ? (
            <div className="space-y-4">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                Interesse registrado com sucesso. O corretor foi avisado.
              </p>
              {whatsappLink ? (
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-700"
                >
                  Continuar no WhatsApp
                </a>
              ) : null}
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                Informe seu WhatsApp para registrar interesse e receber atendimento.
              </p>
              <div>
                <label htmlFor="phone" className="sr-only">
                  WhatsApp
                </label>
                <input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="DDD + número (ex.: 11999998888)"
                  value={phone}
                  onChange={(ev) => setPhone(ev.target.value)}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400/30 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                  required
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-300">
                  1. Quer agendar uma visita?
                  <input
                    value={wantVisit}
                    onChange={(e) => setWantVisit(e.target.value)}
                    placeholder="sim / nao"
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-300">
                  2. Deseja ver mais imóveis como esse?
                  <input
                    value={wantSimilar}
                    onChange={(e) => setWantSimilar(e.target.value)}
                    placeholder="sim / nao"
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  />
                </label>
              </div>
              {submitError ? (
                <p className="text-sm text-red-600" role="alert">
                  {submitError}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                {submitting ? "Registrando..." : "Registrar interesse"}
              </button>
            </form>
          )}
        </div>

        {similar !== null && similar.length > 0 ? (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Outros imóveis do corretor
            </h2>
            <ul className="mt-3 space-y-3">
              {similar.map((s) => {
                const pStr = formatPrice(s.price);
                const label = s.title?.trim() || s.public_id;
                const inner = (
                  <>
                    <p className="font-medium text-zinc-900 dark:text-zinc-50">{label}</p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      {[s.city, s.state].filter(Boolean).join(" / ")}
                      {pStr ? ` · ${pStr}` : ""}
                      {s.purpose ? ` · ${purposeLabel(s.purpose)}` : ""}
                    </p>
                  </>
                );
                return (
                  <li
                    key={s.property_id}
                    className="rounded-xl border border-zinc-200 bg-white/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/80"
                  >
                    {s.qr_token ? (
                      <Link
                        href={`/q/${encodeURIComponent(s.qr_token)}`}
                        className="block hover:opacity-90"
                      >
                        {inner}
                      </Link>
                    ) : (
                      inner
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <p className="mt-8 text-center text-xs text-zinc-500">Ref. {publicId}</p>
      </div>
    </div>
  );
}
