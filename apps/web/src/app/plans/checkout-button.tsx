"use client";

import Link from "next/link";
import { useState } from "react";

import { LEGAL_ROUTES, SUPPORT_EMAIL } from "@/lib/legal";
import { CHECKOUT_PLAN_CODE, STARTER_MONTHLY_BRL } from "@/lib/plans";

type Props = {
  planCode: string;
  label: string;
  className?: string;
  checkoutEnabled?: boolean;
};

export function CheckoutButton({
  planCode,
  label: displayLabel,
  className,
  checkoutEnabled = false,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [acceptRefund, setAcceptRefund] = useState(false);
  const [showLegal, setShowLegal] = useState(false);

  if (planCode !== CHECKOUT_PLAN_CODE) {
    return (
      <Link href="/properties/new" className={className}>
        {displayLabel}
      </Link>
    );
  }

  if (!checkoutEnabled) {
    return (
      <button
        type="button"
        onClick={() => setMessage("Checkout indisponivel ate configurar Stripe neste ambiente.")}
        className={className}
      >
        Checkout indisponivel
      </button>
    );
  }

  async function handleCheckout() {
    setMessage(null);
    if (!acceptTerms || !acceptPrivacy || !acceptRefund) {
      setMessage("Aceite os documentos legais para continuar.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planCode: CHECKOUT_PLAN_CODE,
          acceptTerms: true,
          acceptPrivacy: true,
          acceptRefund: true,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; url?: string; error?: string };
      if (!res.ok || !data.url) {
        setMessage(data.error ?? "Nao foi possivel iniciar o checkout.");
        return;
      }
      window.location.href = data.url;
    } catch {
      setMessage("Erro de conexao. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={() => setShowLegal((v) => !v)}
        className="text-xs text-gray-500 underline"
      >
        {showLegal ? "Ocultar resumo" : "Ver resumo antes do pagamento"}
      </button>

      {showLegal ? (
        <div className="mt-4 space-y-2 border border-gray-200 bg-gray-50 p-4 text-xs text-gray-600">
          <p className="font-semibold text-gray-900">Plano Starter</p>
          <p>
            Preco: R$ {STARTER_MONTHLY_BRL},00/mes · Renovacao automatica · Anuncios ilimitados · QR
            Codes · Leads · Bot WhatsApp
          </p>
          <p>Cancelamento simples pelo portal de assinatura apos a contratacao.</p>
          <p>
            <Link href={LEGAL_ROUTES.terms} className="underline">
              Termos de Uso
            </Link>
            {" · "}
            <Link href={LEGAL_ROUTES.privacy} className="underline">
              Privacidade
            </Link>
            {" · "}
            <Link href={LEGAL_ROUTES.refund_cancellation} className="underline">
              Cancelamento e reembolso
            </Link>
          </p>
          <p>
            Atendimento:{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">
              {SUPPORT_EMAIL}
            </a>
          </p>
          <label className="mt-2 flex items-start gap-2">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="mt-0.5"
            />
            <span>Li e aceito os Termos de Uso (versao vigente).</span>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={acceptPrivacy}
              onChange={(e) => setAcceptPrivacy(e.target.checked)}
              className="mt-0.5"
            />
            <span>Li e aceito a Politica de Privacidade.</span>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={acceptRefund}
              onChange={(e) => setAcceptRefund(e.target.checked)}
              className="mt-0.5"
            />
            <span>Li e aceito as regras de Cancelamento e Reembolso.</span>
          </label>
        </div>
      ) : null}

      <button
        type="button"
        disabled={loading}
        onClick={handleCheckout}
        className={`${className ?? ""} disabled:opacity-70`}
      >
        {loading ? "Redirecionando..." : displayLabel}
      </button>
      {message ? <p className="mt-2 text-xs text-amber-700">{message}</p> : null}
    </div>
  );
}
