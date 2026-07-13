"use client";

import { useState } from "react";

export function ManageSubscriptionButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/customer-portal", { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Portal indisponivel.");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Erro de conexao.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={openPortal}
        disabled={loading}
        className="border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:border-gray-500 disabled:opacity-60"
      >
        {loading ? "Abrindo portal..." : "Gerenciar assinatura (cancelar)"}
      </button>
      {error ? <p className="mt-2 text-xs text-amber-700">{error}</p> : null}
    </div>
  );
}
