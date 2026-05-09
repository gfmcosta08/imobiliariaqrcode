"use client";

import { useState } from "react";

type Props = {
  className?: string;
};

export function TrialButton({ className }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/trial/start", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erro ao iniciar teste.");
        return;
      }

      window.location.href = "/dashboard?trial=started";
    } catch {
      setError("Erro de conexao. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={handleClick} disabled={loading} className={className}>
        {loading ? "Aguarde..." : "Comecar teste"}
      </button>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
