"use client";

import { useState } from "react";

type Profile = { email: string; full_name: string | null };
type Account = { stripe_customer_id: string | null; profiles: Profile | Profile[] | null };
type Subscription = {
  id: string;
  account_id: string;
  plan_code: string;
  status: string;
  billing_provider: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  canceled_at: string | null;
  updated_at: string;
  accounts: Account | null;
};

const STATUSES = ["free", "solo_active", "pro_active", "canceled"];

const PLANS = ["free", "solo", "pro"];

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function firstProfile(account: Account | null): Profile | null {
  const profiles = account?.profiles;
  return Array.isArray(profiles) ? (profiles[0] ?? null) : (profiles ?? null);
}

function userLabel(sub: Subscription): { primary: string; secondary: string } {
  const profile = firstProfile(sub.accounts);
  return {
    primary: profile?.email ?? `Conta ${sub.account_id.slice(0, 8)}`,
    secondary: profile?.full_name ?? "Perfil sem nome/e-mail vinculado",
  };
}

export function SubscriptionsManager() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [results, setResults] = useState<Subscription[]>([]);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Subscription | null>(null);
  const [editPeriodEnd, setEditPeriodEnd] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editPlanCode, setEditPlanCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSearch() {
    setFetching(true);
    setFetchError(null);
    setResults([]);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (planFilter) params.set("plan", planFilter);
      const res = await fetch(`/api/admin/subscriptions?${params}`);
      const data = (await res.json()) as { ok: boolean; data: Subscription[]; error?: string };
      if (!data.ok) {
        setFetchError(data.error ?? "Erro ao buscar");
        return;
      }
      setResults(data.data);
    } catch {
      setFetchError("Erro de conexão");
    } finally {
      setFetching(false);
    }
  }

  function startEdit(sub: Subscription) {
    setEditing(sub);
    setEditPeriodEnd(toDateInputValue(sub.current_period_end));
    setEditStatus(sub.status);
    setEditPlanCode(sub.plan_code);
    setSaveMsg(null);
    setSaveError(null);
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    setSaveError(null);
    setSaveMsg(null);
    try {
      const body: Record<string, unknown> = { status: editStatus, plan_code: editPlanCode };
      if (editPeriodEnd) {
        body.current_period_end = new Date(editPeriodEnd).toISOString();
      }
      const res = await fetch(`/api/admin/subscriptions/${editing.account_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        setSaveError(data.error ?? "Erro ao salvar");
        return;
      }
      setSaveMsg("Salvo com sucesso");
      setResults((prev) =>
        prev.map((s) =>
          s.account_id === editing.account_id
            ? {
                ...s,
                status: editStatus,
                plan_code: editPlanCode,
                current_period_end: editPeriodEnd
                  ? new Date(editPeriodEnd).toISOString()
                  : s.current_period_end,
              }
            : s,
        ),
      );
      setEditing(null);
    } catch {
      setSaveError("Erro de conexão");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Buscar por e-mail ou nome..."
          className="flex-1 min-w-48 border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <select
          className="border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Todos os status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className="border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
        >
          <option value="">Todos os planos</option>
          {PLANS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <button
          onClick={handleSearch}
          disabled={fetching}
          className="bg-black px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {fetching ? "Buscando..." : "Buscar"}
        </button>
      </div>

      {fetchError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2">{fetchError}</p>}

      {/* Resultados */}
      {results.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Usuário
                </th>
                <th className="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Plano
                </th>
                <th className="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Status
                </th>
                <th className="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Validade
                </th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {results.map((sub) => {
                const user = userLabel(sub);
                return (
                  <tr key={sub.id}>
                    <td className="py-3 pr-4">
                      <p className="font-medium text-gray-900">{user.primary}</p>
                      <p className="text-xs text-gray-400">{user.secondary}</p>
                      {sub.billing_provider === "stripe" && (
                        <p className="text-xs text-amber-600">Stripe — editar com cuidado</p>
                      )}
                    </td>
                    <td className="py-3 pr-4 font-mono text-gray-700">{sub.plan_code}</td>
                    <td className="py-3 pr-4 text-gray-600">{sub.status}</td>
                    <td className="py-3 pr-4 text-gray-600">{fmtDate(sub.current_period_end)}</td>
                    <td className="py-3">
                      <button
                        onClick={() => startEdit(sub)}
                        className="border border-gray-300 px-3 py-1 text-xs text-gray-700 transition hover:border-gray-500"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {results.length === 0 && !fetching && !fetchError && (
        <p className="text-sm text-gray-400">Use os filtros acima e clique em Buscar.</p>
      )}

      {/* Modal de edição */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md bg-white p-6 shadow-xl">
            <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">
              Editar assinatura
            </h3>
            <p className="mt-1 text-sm font-medium text-gray-900">{userLabel(editing).primary}</p>

            {editing.billing_provider === "stripe" && (
              <p className="mt-3 text-xs bg-amber-50 border border-amber-200 px-3 py-2 text-amber-700">
                Esta conta usa Stripe. Alterar manualmente pode causar divergência com a cobrança
                real.
              </p>
            )}

            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="text-xs text-gray-500">Plano</span>
                <select
                  className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
                  value={editPlanCode}
                  onChange={(e) => setEditPlanCode(e.target.value)}
                >
                  {PLANS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs text-gray-500">Status</span>
                <select
                  className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs text-gray-500">Data de validade</span>
                <input
                  type="date"
                  className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
                  value={editPeriodEnd}
                  onChange={(e) => setEditPeriodEnd(e.target.value)}
                />
              </label>
            </div>

            {saveError && (
              <p className="mt-3 text-sm text-red-600 bg-red-50 px-3 py-2">{saveError}</p>
            )}
            {saveMsg && <p className="mt-3 text-sm text-green-600">{saveMsg}</p>}

            <div className="mt-5 flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-black px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
              <button
                onClick={() => setEditing(null)}
                className="border border-gray-300 px-5 py-2 text-sm text-gray-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
