"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ActivateResult = {
  ok: boolean;
  error?: string;
};

function messageFor(error?: string) {
  if (error === "solo_active_property_exists") return "Ja existe um imovel ativo no Solo.";
  if (error === "property_not_eligible") return "Este imovel nao pode ser ativado no Solo.";
  if (error === "not_solo_active") return "Sua conta nao esta no plano Solo ativo.";
  return "Nao foi possivel ativar este imovel.";
}

export function SoloActivateButton({ propertyId }: { propertyId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function activate() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/properties/${propertyId}/activate-solo`, { method: "POST" });
      const data = (await res.json()) as ActivateResult;
      if (!data.ok) {
        setError(messageFor(data.error));
        return;
      }
      router.refresh();
    } catch {
      setError("Erro de conexao.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={activate}
        disabled={loading}
        className="border border-gray-300 px-4 py-2 text-xs font-medium text-gray-800 transition hover:border-gray-500 disabled:opacity-50"
      >
        {loading ? "Ativando..." : "Ativar no Solo"}
      </button>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
