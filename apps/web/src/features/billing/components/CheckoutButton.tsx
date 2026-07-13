"use client";

import { useState } from "react";

type Props = {
  label: string;
  className?: string;
  enabled?: boolean;
};

function mapCheckoutError(error: string | undefined): string {
  switch (error) {
    case "unauthenticated":
      return "Entre para contratar o Starter.";
    case "stripe_price_missing":
      return "Checkout ainda nao configurado no staging.";
    case "stripe_config_invalid":
      return "Configuracao Stripe invalida no staging.";
    default:
      return "Nao foi possivel iniciar o checkout.";
  }
}

export function CheckoutButton({ label, className, enabled = true }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function startCheckout() {
    if (!enabled) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/stripe/create-checkout", { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; url?: string; error?: string };
      if (data.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setMessage(mapCheckoutError(data.error));
    } catch {
      setMessage("Nao foi possivel iniciar o checkout.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void startCheckout()}
        disabled={!enabled || loading}
        className={className}
      >
        {loading ? "Abrindo checkout..." : label}
      </button>
      {message && <p className="mt-2 text-xs text-amber-700">{message}</p>}
    </div>
  );
}
