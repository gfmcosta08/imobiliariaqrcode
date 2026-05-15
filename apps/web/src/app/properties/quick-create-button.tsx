"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type QuickCreateResult = {
  ok: boolean;
  property_id?: string;
  error?: string;
  detail?: string;
};

export function QuickCreateButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/properties/quick-create", { method: "POST" });
      const data = (await res.json()) as QuickCreateResult;
      if (!data.ok || !data.property_id) {
        const msg =
          data.error === "plan_limit_reached"
            ? "Limite de imoveis ativos do plano atingido."
            : data.error === "no_active_plan"
              ? "Sem plano ativo."
              : data.error === "broker_not_found"
                ? "Corretor nao encontrado para o usuario logado."
                : data.error === "unauthorized"
                  ? "Sessao expirada. Faca login novamente."
                  : data.error === "property_create_failed"
                    ? `Falha ao salvar anuncio: ${data.detail ?? "erro no banco"}`
                    : data.error === "quick_create_exception"
                      ? `Falha no servidor de teste: ${data.detail ?? "erro interno"}`
                      : "Erro ao criar imovel.";
        setError(msg);
        return;
      }
      router.push(`/properties/${data.property_id}`);
    } catch {
      setError("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Criando..." : "+ Novo imóvel"}
      </button>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
