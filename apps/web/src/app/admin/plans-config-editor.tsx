"use client";

import { useEffect, useState } from "react";

type PlanConfig = {
  code: string;
  expiration_days: number | null;
  max_active_properties: number | null;
  max_brokers: number | null;
  has_auto_expiration: boolean;
};

type ApiResponse = { ok: boolean; config: PlanConfig[]; error?: string };

const PLAN_ORDER = ["trial", "solo", "pro", "premium"];

export function PlansConfigEditor() {
  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [form, setForm] = useState<PlanConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/plans")
      .then((r) => r.json())
      .then((d: ApiResponse) => {
        if (d.ok) {
          const sorted = [...d.config].sort(
            (a, b) => PLAN_ORDER.indexOf(a.code) - PLAN_ORDER.indexOf(b.code),
          );
          setPlans(sorted);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  function startEdit(plan: PlanConfig) {
    setEditingCode(plan.code);
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
      const res = await fetch(`/api/admin/plans/${form.code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expiration_days: form.expiration_days,
          max_active_properties: form.max_active_properties,
          max_brokers: form.max_brokers,
          has_auto_expiration: form.has_auto_expiration,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        setError(data.error ?? "Erro ao salvar");
        return;
      }
      setPlans((prev) => prev.map((p) => (p.code === form.code ? { ...form } : p)));
      setSaved(form.code);
      setEditingCode(null);
      setForm(null);
    } catch {
      setError("Erro de conexão");
    } finally {
      setSaving(false);
    }
  }

  function setField<K extends keyof PlanConfig>(key: K, value: PlanConfig[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function parseNullableInt(val: string): number | null {
    const n = parseInt(val, 10);
    return isNaN(n) ? null : n;
  }

  if (loading) {
    return <p className="mt-4 text-sm text-gray-400">Carregando...</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">
              Plano
            </th>
            <th className="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">
              Validade (dias)
            </th>
            <th className="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">
              Máx. imóveis
            </th>
            <th className="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">
              Máx. corretores
            </th>
            <th className="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">
              Auto-expiração
            </th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {plans.map((plan) => (
            <tr key={plan.code}>
              {editingCode === plan.code && form ? (
                <>
                  <td className="py-3 pr-4 font-mono text-gray-700">{plan.code}</td>
                  <td className="py-3 pr-4">
                    <input
                      type="number"
                      className="w-20 border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:border-gray-500"
                      value={form.expiration_days ?? ""}
                      placeholder="null"
                      onChange={(e) =>
                        setField("expiration_days", parseNullableInt(e.target.value))
                      }
                    />
                  </td>
                  <td className="py-3 pr-4">
                    <input
                      type="number"
                      className="w-20 border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:border-gray-500"
                      value={form.max_active_properties ?? ""}
                      placeholder="∞"
                      onChange={(e) =>
                        setField(
                          "max_active_properties",
                          parseNullableInt(e.target.value),
                        )
                      }
                    />
                  </td>
                  <td className="py-3 pr-4">
                    <input
                      type="number"
                      className="w-20 border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:border-gray-500"
                      value={form.max_brokers ?? ""}
                      placeholder="∞"
                      onChange={(e) =>
                        setField("max_brokers", parseNullableInt(e.target.value))
                      }
                    />
                  </td>
                  <td className="py-3 pr-4">
                    <input
                      type="checkbox"
                      checked={form.has_auto_expiration}
                      onChange={(e) => setField("has_auto_expiration", e.target.checked)}
                    />
                  </td>
                  <td className="py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-black px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                      >
                        {saving ? "..." : "Salvar"}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="border border-gray-300 px-3 py-1 text-xs text-gray-700"
                      >
                        Cancelar
                      </button>
                    </div>
                    {error && (
                      <p className="mt-1 text-xs text-red-600">{error}</p>
                    )}
                  </td>
                </>
              ) : (
                <>
                  <td className="py-3 pr-4 font-mono text-gray-700">
                    {plan.code}
                    {saved === plan.code && (
                      <span className="ml-2 text-xs font-semibold text-green-600">✓</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-gray-600">
                    {plan.expiration_days ?? "∞"}
                  </td>
                  <td className="py-3 pr-4 text-gray-600">
                    {plan.max_active_properties ?? "∞"}
                  </td>
                  <td className="py-3 pr-4 text-gray-600">
                    {plan.max_brokers ?? "∞"}
                  </td>
                  <td className="py-3 pr-4 text-gray-600">
                    {plan.has_auto_expiration ? "sim" : "não"}
                  </td>
                  <td className="py-3">
                    <button
                      onClick={() => startEdit(plan)}
                      className="border border-gray-300 px-3 py-1 text-xs text-gray-700 transition hover:border-gray-500"
                    >
                      Editar
                    </button>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-gray-400">
        Alterações não afetam assinaturas já ativas — apenas novas ativações.
      </p>
    </div>
  );
}
