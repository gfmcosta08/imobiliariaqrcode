"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  needsWhatsapp: boolean;
};

export function QuickPropertyForm({ needsWhatsapp }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const payload = {
      title: String(form.get("title") ?? ""),
      property_type: String(form.get("property_type") ?? ""),
      city: String(form.get("city") ?? ""),
      neighborhood: String(form.get("neighborhood") ?? ""),
      sale_price: String(form.get("sale_price") ?? ""),
      rent_price: String(form.get("rent_price") ?? ""),
      whatsapp_number: String(form.get("whatsapp_number") ?? ""),
      description: String(form.get("description") ?? ""),
    };

    try {
      const res = await fetch("/api/properties/quick-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        next_url?: string;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.next_url) {
        setError(data.error ?? "Nao foi possivel criar o imovel.");
        return;
      }
      router.push(data.next_url);
    } catch {
      setError("Erro de conexao.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4 border border-gray-200 p-6">
      <label className="block text-sm text-gray-700">
        Titulo
        <input name="title" required className="mt-1 w-full border border-gray-200 px-3 py-2" />
      </label>
      <label className="block text-sm text-gray-700">
        Tipo
        <select
          name="property_type"
          defaultValue="Residencial"
          className="mt-1 w-full border border-gray-200 px-3 py-2"
        >
          <option>Residencial</option>
          <option>Comercial</option>
        </select>
      </label>
      <label className="block text-sm text-gray-700">
        Cidade
        <input name="city" required className="mt-1 w-full border border-gray-200 px-3 py-2" />
      </label>
      <label className="block text-sm text-gray-700">
        Bairro
        <input name="neighborhood" className="mt-1 w-full border border-gray-200 px-3 py-2" />
      </label>
      <label className="block text-sm text-gray-700">
        Preco venda (R$)
        <input name="sale_price" className="mt-1 w-full border border-gray-200 px-3 py-2" />
      </label>
      <label className="block text-sm text-gray-700">
        Preco aluguel (R$)
        <input name="rent_price" className="mt-1 w-full border border-gray-200 px-3 py-2" />
      </label>
      {needsWhatsapp ? (
        <label className="block text-sm text-gray-700">
          WhatsApp
          <input
            name="whatsapp_number"
            required
            className="mt-1 w-full border border-gray-200 px-3 py-2"
          />
        </label>
      ) : null}
      <label className="block text-sm text-gray-700">
        Descricao (opcional)
        <textarea
          name="description"
          rows={3}
          className="mt-1 w-full border border-gray-200 px-3 py-2"
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="bg-black px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
      >
        {loading ? "Criando..." : "Criar meu primeiro QR"}
      </button>
      {error ? <p className="text-sm text-amber-700">{error}</p> : null}
    </form>
  );
}
