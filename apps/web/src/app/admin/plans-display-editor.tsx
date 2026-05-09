"use client";

import { useEffect, useState } from "react";

type PlanDisplay = {
  plan_code: string;
  display_name: string;
  display_price: string;
  display_suffix: string;
  display_note: string;
  display_label: string;
  display_featured: boolean;
  features: string[];
};

type ApiResponse = { ok: boolean; display: PlanDisplay[]; error?: string };

const PLAN_ORDER = ["trial", "solo", "pro", "premium"];

export function PlansDisplayEditor() {
  const [plans, setPlans] = useState<PlanDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [form, setForm] = useState<PlanDisplay | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/plans")
      .then((r) => r.json())
      .then((d: ApiResponse) => {
        if (d.ok) {
          const sorted = [...d.display].sort(
            (a, b) => PLAN_ORDER.indexOf(a.plan_code) - PLAN_ORDER.indexOf(b.plan_code),
          );
          setPlans(sorted);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  function startEdit(plan: PlanDisplay) {
    setEditingCode(plan.plan_code);
    setForm({ ...plan });
    setError(null);
    setSaved(null);
  }

  function cancelEdit() {
    setEditingCode(null);
    setForm(null);
  }

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/plans/${form.plan_code}/display`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: form.display_name,
          display_price: form.display_price,
          display_suffix: form.display_suffix,
          display_note: form.display_note,
          display_label: form.display_label,
          display_featured: form.display_featured,
          features: form.features,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        setError(data.error ?? "Erro ao salvar");
        return;
      }
      setPlans((prev) =>
        prev.map((p) => (p.plan_code === form.plan_code ? { ...form } : p)),
      );
      setSaved(form.plan_code);
      setEditingCode(null);
      setForm(null);
    } catch {
      setError("Erro de conexão");
    } finally {
      setSaving(false);
    }
  }

  function setField<K extends keyof PlanDisplay>(key: K, value: PlanDisplay[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  if (loading) {
    return <p className="mt-4 text-sm text-gray-400">Carregando...</p>;
  }

  return (
    <div className="space-y-4">
      {plans.map((plan) => (
        <div key={plan.plan_code} className="border border-gray-200 p-5">
          {editingCode === plan.plan_code && form ? (
            <div className="space-y-4">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
                Editando: {plan.plan_code}
              </p>

              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs text-gray-500">Nome de exibição</span>
                  <input
                    className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
                    value={form.display_name}
                    onChange={(e) => setField("display_name", e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-gray-500">Preço exibido</span>
                  <input
                    className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
                    value={form.display_price}
                    onChange={(e) => setField("display_price", e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-gray-500">Sufixo (ex: /mês)</span>
                  <input
                    className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
                    value={form.display_suffix}
                    onChange={(e) => setField("display_suffix", e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-gray-500">Nota (ex: Renovação mensal)</span>
                  <input
                    className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
                    value={form.display_note}
                    onChange={(e) => setField("display_note", e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-gray-500">Texto do botão</span>
                  <input
                    className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
                    value={form.display_label}
                    onChange={(e) => setField("display_label", e.target.value)}
                  />
                </label>
                <label className="flex items-center gap-2 mt-5">
                  <input
                    type="checkbox"
                    checked={form.display_featured}
                    onChange={(e) => setField("display_featured", e.target.checked)}
                  />
                  <span className="text-sm text-gray-600">Destaque (borda preta)</span>
                </label>
              </div>

              <label className="block">
                <span className="text-xs text-gray-500">
                  Benefícios (um por linha)
                </span>
                <textarea
                  className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
                  rows={5}
                  value={form.features.join("\n")}
                  onChange={(e) =>
                    setField(
                      "features",
                      e.target.value.split("\n").map((l) => l.trim()).filter(Boolean),
                    )
                  }
                />
              </label>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2">{error}</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-black px-5 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50"
                >
                  {saving ? "Salvando..." : "Salvar"}
                </button>
                <button
                  onClick={cancelEdit}
                  className="border border-gray-300 px-5 py-2 text-sm text-gray-700 transition hover:border-gray-500"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{plan.display_name}</span>
                  <span className="text-xs font-mono text-gray-400">{plan.plan_code}</span>
                  {plan.display_featured && (
                    <span className="text-xs font-semibold uppercase text-black">destaque</span>
                  )}
                  {saved === plan.plan_code && (
                    <span className="text-xs font-semibold text-green-600">✓ salvo</span>
                  )}
                </div>
                <p className="mt-1 text-sm text-gray-600">
                  {plan.display_price}
                  {plan.display_suffix} · {plan.display_note || "—"}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  {plan.features.length} benefício(s) · botão: &quot;{plan.display_label}&quot;
                </p>
              </div>
              <button
                onClick={() => startEdit(plan)}
                className="flex-shrink-0 border border-gray-300 px-4 py-1.5 text-xs text-gray-700 transition hover:border-gray-500"
              >
                Editar
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
