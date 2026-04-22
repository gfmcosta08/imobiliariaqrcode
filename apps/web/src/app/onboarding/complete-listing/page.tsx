"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface PropertyForm {
  title: string;
  property_type: string;
  property_subtype: string;
  purpose: string;
  city: string;
  state: string;
  neighborhood: string;
  address_line: string;
  postal_code: string;
  bedrooms: string;
  bathrooms: string;
  parking_spaces: string;
  area_m2: string;
  price: string;
  description: string;
}

const EMPTY_FORM: PropertyForm = {
  title: "",
  property_type: "residential",
  property_subtype: "apartment",
  purpose: "sale",
  city: "",
  state: "",
  neighborhood: "",
  address_line: "",
  postal_code: "",
  bedrooms: "0",
  bathrooms: "0",
  parking_spaces: "0",
  area_m2: "",
  price: "",
  description: "",
};

export default function CompleteListingPage() {
  const router = useRouter();
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [form, setForm] = useState<PropertyForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadInvitationProperty() {
      const supabase = createClient();
      const { data } = await supabase.rpc("get_my_invitation_property");
      if (data) {
        setPropertyId(data as string);
      }
      setFetchLoading(false);
    }
    void loadInvitationProperty();
  }, []);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!propertyId) {
      setError("Imovel nao encontrado. Entre em contato com o suporte.");
      return;
    }
    if (!form.title.trim() || !form.city.trim() || !form.state.trim()) {
      setError("Titulo, cidade e estado sao obrigatorios.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();

      const { error: updateError } = await supabase
        .from("properties")
        .update({
          title: form.title.trim(),
          property_type: form.property_type,
          property_subtype: form.property_subtype,
          purpose: form.purpose,
          city: form.city.trim(),
          state: form.state.trim(),
          neighborhood: form.neighborhood.trim() || null,
          address_line: form.address_line.trim() || null,
          postal_code: form.postal_code.replace(/\D/g, "") || null,
          bedrooms: parseInt(form.bedrooms) || 0,
          bathrooms: parseInt(form.bathrooms) || 0,
          parking_spaces: parseInt(form.parking_spaces) || 0,
          area_m2: form.area_m2 ? parseFloat(form.area_m2) : null,
          price: form.price ? parseFloat(form.price.replace(/\D/g, "")) : null,
          description: form.description.trim(),
          listing_status: "published",
        })
        .eq("id", propertyId);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      // Marcar convite como claimed
      await supabase
        .from("broker_invitations")
        .update({ status: "claimed", claimed_at: new Date().toISOString() })
        .eq("property_id", propertyId);

      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  }

  if (fetchLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-md p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Complete seu anuncio</h1>
          <p className="text-sm text-gray-500 mt-1">
            Passo 2 de 2 &mdash; Dados do imovel
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titulo do anuncio *</label>
            <input
              name="title"
              type="text"
              required
              value={form.title}
              onChange={handleChange}
              placeholder="Ex: Apartamento 3 quartos com varanda"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select
                name="property_type"
                value={form.property_type}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="residential">Residencial</option>
                <option value="commercial">Comercial</option>
                <option value="land">Terreno</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Finalidade</label>
              <select
                name="purpose"
                value={form.purpose}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="sale">Venda</option>
                <option value="rent">Aluguel</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cidade *</label>
              <input
                name="city"
                type="text"
                required
                value={form.city}
                onChange={handleChange}
                placeholder="Sao Paulo"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado *</label>
              <input
                name="state"
                type="text"
                required
                maxLength={2}
                value={form.state}
                onChange={handleChange}
                placeholder="SP"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bairro</label>
            <input
              name="neighborhood"
              type="text"
              value={form.neighborhood}
              onChange={handleChange}
              placeholder="Nome do bairro"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Endereco</label>
            <input
              name="address_line"
              type="text"
              value={form.address_line}
              onChange={handleChange}
              placeholder="Rua, numero, complemento"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quartos</label>
              <input
                name="bedrooms"
                type="number"
                min="0"
                value={form.bedrooms}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Banheiros</label>
              <input
                name="bathrooms"
                type="number"
                min="0"
                value={form.bathrooms}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vagas</label>
              <input
                name="parking_spaces"
                type="number"
                min="0"
                value={form.parking_spaces}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Area (m²)</label>
              <input
                name="area_m2"
                type="number"
                min="0"
                step="0.01"
                value={form.area_m2}
                onChange={handleChange}
                placeholder="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Preco (R$)</label>
              <input
                name="price"
                type="text"
                value={form.price}
                onChange={handleChange}
                placeholder="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descricao</label>
            <textarea
              name="description"
              rows={4}
              value={form.description}
              onChange={handleChange}
              placeholder="Descreva o imovel..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors mt-2"
          >
            {loading ? "Publicando..." : "Publicar anuncio"}
          </button>
        </form>
      </div>
    </div>
  );
}
