"use client";

import { useEffect, useState } from "react";

type PlanDisplay = {
  plan_code: string;
  display_name: string;
  display_price: string;
  display_suffix: string;
  display_note: string;
  display_description: string;
  display_label: string;
  display_featured: boolean;
  features: string[];
};

type PlanConfig = {
  code: string;
  expiration_days: number | null;
  max_active_properties: number | null;
  has_auto_expiration: boolean;
};

type PlanForm = PlanDisplay & PlanConfig;
type ApiResponse = {
  ok: boolean;
  display: PlanDisplay[];
  config: PlanConfig[];
  error?: string;
};

const PLAN_ORDER = ["free", "solo", "pro"];
const PLAN_LABEL: Record<string, string> = {
  free: "Free",
  solo: "Solo",
  pro: "Pro",
};

function sortPlans<T extends { plan_code?: string; code?: string }>(plans: T[]) {
  return [...plans].sort((a, b) => {
    const aCode = a.plan_code ?? a.code ?? "";
    const bCode = b.plan_code ?? b.code ?? "";
    return PLAN_ORDER.indexOf(aCode) - PLAN_ORDER.indexOf(bCode);
  });
}

function parseNullableInt(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function formatLimit(value: number | null) {
  return value === null ? "sem limite" : String(value);
}

function mergePlans(display: PlanDisplay[], config: PlanConfig[]): PlanForm[] {
  const configByCode = new Map(config.map((plan) => [plan.code, plan]));
  return sortPlans(display)
    .filter((plan) => PLAN_ORDER.includes(plan.plan_code))
    .map((plan) => {
      const technical = configByCode.get(plan.plan_code);
      return {
        ...plan,
        display_description: plan.display_description ?? "",
        code: plan.plan_code,
        expiration_days: technical?.expiration_days ?? null,
        max_active_properties: technical?.max_active_properties ?? null,
        has_auto_expiration: technical?.has_auto_expiration ?? false,
      };
    });
}

export function PlansEditor() {
  const [plans, setPlans] = useState<PlanForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [form, setForm] = useState<PlanForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/plans")
      .then((r) => r.json())
      .then((data: ApiResponse) => {
        if (data.ok) {
          setPlans(mergePlans(data.display, data.config));
        } else {
          setError(data.error ?? "Erro ao carregar planos");
        }
      })
      .catch(() => setError("Erro de conexao"))
      .finally(() => setLoading(false));
  }, []);

  function startEdit(plan: PlanForm) {
    setEditingCode(plan.plan_code);
    setForm({ ...plan });
    setSaved(null);
    setError(null);
  }

  function cancelEdit() {
    setEditingCode(null);
    setForm(null);
    setError(null);
  }

  function setField<K extends keyof PlanForm>(key: K, value: PlanForm[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    setError(null);

    try {
      const [displayRes, configRes] = await Promise.all([
        fetch(`/api/admin/plans/${form.plan_code}/display`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            display_name: form.display_name,
            display_price: form.display_price,
            display_suffix: form.display_suffix,
            display_note: form.display_note,
            display_description: form.display_description,
            display_label: form.display_label,
            display_featured: form.display_featured,
            features: form.features,
          }),
        }),
        fetch(`/api/admin/plans/${form.plan_code}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expiration_days: form.expiration_days,
            max_active_properties: form.max_active_properties,
            has_auto_expiration: form.has_auto_expiration,
          }),
        }),
      ]);

      const displayData = (await displayRes.json()) as { ok: boolean; error?: string };
      const configData = (await configRes.json()) as { ok: boolean; error?: string };
      if (!displayData.ok || !configData.ok) {
        setError(displayData.error ?? configData.error ?? "Erro ao salvar plano");
        return;
      }

      setPlans((prev) => prev.map((plan) => (plan.plan_code === form.plan_code ? form : plan)));
      setSaved(form.plan_code);
      setEditingCode(null);
      setForm(null);
    } catch {
      setError("Erro de conexao");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="mt-4 text-sm text-gray-400">Carregando...</p>;
  }

  return (
    <div className="space-y-4">
      {error && !editingCode ? (
        <p className="border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      {plans.map((plan) => (
        <div key={plan.plan_code} className="border border-gray-200 p-5">
          {editingCode === plan.plan_code && form ? (
            <div className="space-y-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
                  Editando: {PLAN_LABEL[plan.plan_code] ?? plan.plan_code}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  O preco exibido muda somente o texto publico. Checkout online esta temporariamente
                  desativado.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-xs text-gray-500">Nome exibido</span>
                  <input
                    className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
                    value={form.display_name}
                    onChange={(e) => setField("display_name", e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-gray-500">Preco exibido</span>
                  <input
                    className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
                    value={form.display_price}
                    onChange={(e) => setField("display_price", e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-gray-500">Sufixo</span>
                  <input
                    className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
                    value={form.display_suffix}
                    placeholder="/mes, trimestral..."
                    onChange={(e) => setField("display_suffix", e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-gray-500">Nota curta</span>
                  <input
                    className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
                    value={form.display_note}
                    onChange={(e) => setField("display_note", e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-gray-500">Texto do botao</span>
                  <input
                    className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
                    value={form.display_label}
                    onChange={(e) => setField("display_label", e.target.value)}
                  />
                </label>
                <label className="mt-5 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.display_featured}
                    onChange={(e) => setField("display_featured", e.target.checked)}
                  />
                  <span className="text-sm text-gray-600">Destaque visual</span>
                </label>
              </div>

              <label className="block">
                <span className="text-xs text-gray-500">Descricao/explanacao livre</span>
                <textarea
                  className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
                  rows={3}
                  value={form.display_description}
                  onChange={(e) => setField("display_description", e.target.value)}
                />
              </label>

              <label className="block">
                <span className="text-xs text-gray-500">Beneficios, um por linha</span>
                <textarea
                  className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
                  rows={5}
                  value={form.features.join("\n")}
                  onChange={(e) =>
                    setField(
                      "features",
                      e.target.value
                        .split("\n")
                        .map((line) => line.trim())
                        .filter(Boolean),
                    )
                  }
                />
              </label>

              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
                  Configuracao tecnica
                </p>
                <div className="mt-3 grid gap-4 md:grid-cols-4">
                  <label className="block">
                    <span className="text-xs text-gray-500">Validade em dias</span>
                    <input
                      type="number"
                      min={1}
                      className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
                      value={form.expiration_days ?? ""}
                      placeholder="sem limite"
                      onChange={(e) =>
                        setField("expiration_days", parseNullableInt(e.target.value))
                      }
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-gray-500">Maximo de imoveis</span>
                    <input
                      type="number"
                      min={1}
                      className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
                      value={form.max_active_properties ?? ""}
                      placeholder="sem limite"
                      onChange={(e) =>
                        setField("max_active_properties", parseNullableInt(e.target.value))
                      }
                    />
                  </label>
                  <label className="mt-6 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.has_auto_expiration}
                      onChange={(e) => setField("has_auto_expiration", e.target.checked)}
                    />
                    <span className="text-sm text-gray-600">Auto-expiracao</span>
                  </label>
                </div>
              </div>

              {error ? (
                <p className="border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              ) : null}

              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-black px-5 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50"
                >
                  {saving ? "Salvando..." : "Salvar plano"}
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
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-gray-900">{plan.display_name}</span>
                  <span className="text-xs font-mono text-gray-400">{plan.plan_code}</span>
                  {plan.display_featured ? (
                    <span className="text-xs font-semibold uppercase text-black">destaque</span>
                  ) : null}
                  {saved === plan.plan_code ? (
                    <span className="text-xs font-semibold text-green-600">salvo</span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-gray-600">
                  {plan.display_price}
                  {plan.display_suffix} - {plan.display_note || "sem nota"}
                </p>
                {plan.display_description ? (
                  <p className="mt-1 max-w-3xl text-sm text-gray-500">{plan.display_description}</p>
                ) : null}
                <p className="mt-2 text-xs text-gray-400">
                  {plan.features.length} beneficio(s) - botao: &quot;{plan.display_label}&quot; -
                  validade: {formatLimit(plan.expiration_days)} - imoveis:{" "}
                  {formatLimit(plan.max_active_properties)}
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
