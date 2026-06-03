"use client";

import { useState } from "react";

type PendingInvitation = {
  id: string;
  login_code: string;
  status: string;
  generated_at: string;
  expires_at: string | null;
  courtesy_expires_at: string | null;
  claimed_at: string | null;
  completed_at: string | null;
  property_count: number;
  expiration_days_configured: number;
};

type Props = {
  initialInvitations: PendingInvitation[];
};

export function PendingInvitationsList({ initialInvitations }: Props) {
  const [items, setItems] = useState<PendingInvitation[]>(initialInvitations);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(invitation: PendingInvitation) {
    if (!confirm(`Cancelar convite pendente ${invitation.login_code}?`)) return;

    setDeletingId(invitation.id);
    setError(null);

    try {
      const res = await fetch(`/api/admin/invitations?id=${encodeURIComponent(invitation.id)}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; detail?: string };

      if (!res.ok || !data.ok) {
        setError(
          data.detail ? `${data.error}: ${data.detail}` : (data.error ?? "Falha ao excluir convite."),
        );
        return;
      }

      setItems((prev) => prev.filter((item) => item.id !== invitation.id));
    } catch {
      setError("Erro de conexao ao excluir convite.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSave(invitation: PendingInvitation, form: HTMLFormElement) {
    const formData = new FormData(form);
    const propertyCount = Number(formData.get("property_count"));
    const expiresAt = String(formData.get("expires_at") ?? "");
    const reason = String(formData.get("reason") ?? "").trim();
    if (!confirm("Salvar alteracao? Imoveis excedentes mais antigos poderao ser arquivados.")) return;

    setSavingId(invitation.id);
    setError(null);
    try {
      const res = await fetch("/api/admin/invitations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: invitation.id,
          property_count: propertyCount,
          expires_at: new Date(`${expiresAt}T23:59:59-03:00`).toISOString(),
          reason,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        detail?: string;
        result?: { status?: string; archived_property_ids?: string[]; expires_at?: string };
      };
      if (!res.ok || !data.ok) {
        setError(data.detail ? `${data.error}: ${data.detail}` : (data.error ?? "Falha ao salvar."));
        return;
      }
      const archivedCount = data.result?.archived_property_ids?.length ?? 0;
      setItems((prev) =>
        prev.map((item) =>
          item.id === invitation.id
            ? {
                ...item,
                property_count: propertyCount,
                courtesy_expires_at: data.result?.expires_at ?? item.courtesy_expires_at,
                status: data.result?.status ?? item.status,
              }
            : item,
        ),
      );
      setEditingId(null);
      setError(
        archivedCount > 0
          ? `Cortesia atualizada. ${archivedCount} imovel(is) antigo(s) arquivado(s).`
          : "Cortesia atualizada.",
      );
    } catch {
      setError("Erro de conexao ao salvar cortesia.");
    } finally {
      setSavingId(null);
    }
  }

  function statusLabel(status: string): string {
    if (status === "claimed") return "Em onboarding";
    if (status === "completed") return "Concluido";
    if (status === "expired") return "Expirado";
    if (status === "canceled") return "Cancelado";
    return "Pendente";
  }

  function statusClass(status: string): string {
    if (status === "claimed") return "text-blue-700";
    if (status === "completed") return "text-green-700";
    if (status === "expired" || status === "canceled") return "text-red-500";
    return "text-yellow-600";
  }

  function formatDate(value: string | null): string {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("pt-BR");
  }

  function inputDate(value: string | null): string {
    return value ? new Date(value).toISOString().slice(0, 10) : "";
  }

  return (
    <div className="mt-12 border border-gray-200 p-6">
      <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Convites gerados</h3>

      {error ? <p className="mt-4 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-gray-400">Nenhum convite gerado.</p>
      ) : (
        <ul className="mt-4 divide-y divide-gray-100" data-testid="admin-invitations-list">
          {items.map((inv) => (
            <li
              key={inv.id}
              className="py-3"
              data-testid="admin-invitation-item"
            >
              <div className="flex items-center justify-between gap-4">
              <div>
                <span
                  className="text-sm font-mono font-semibold text-gray-900"
                  data-testid="admin-invitation-login-code"
                >
                  Login: {inv.login_code}
                </span>
                <span className="ml-4 text-xs text-gray-400">
                  Gerado: {formatDate(inv.generated_at)}
                </span>
                <span className="ml-3 text-xs text-gray-400">
                  {inv.property_count} imovel(is) · {inv.expiration_days_configured} dias
                </span>
                {inv.claimed_at ? (
                  <span className="ml-3 text-xs text-gray-400">Ativado: {formatDate(inv.claimed_at)}</span>
                ) : null}
                {inv.completed_at ? (
                  <span className="ml-3 text-xs text-gray-400">Concluido: {formatDate(inv.completed_at)}</span>
                ) : null}
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`text-xs font-semibold uppercase tracking-wide ${statusClass(inv.status)}`}
                  data-testid="admin-invitation-status"
                >
                  {statusLabel(inv.status)}
                </span>
                <button
                  type="button"
                  onClick={() => setEditingId(editingId === inv.id ? null : inv.id)}
                  data-testid="admin-invitation-edit"
                  className="border border-gray-300 px-3 py-1 text-xs text-gray-700"
                >
                  Editar
                </button>
                {inv.status === "pending" ? (
                  <button
                    type="button"
                    onClick={() => handleDelete(inv)}
                    disabled={deletingId === inv.id}
                    data-testid="admin-invitation-cancel"
                    className="border border-red-300 px-3 py-1 text-xs text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                  >
                    {deletingId === inv.id ? "Cancelando..." : "Cancelar"}
                  </button>
                ) : null}
              </div>
              </div>
              {editingId === inv.id ? (
                <form
                  className="mt-3 grid gap-3 border border-gray-100 bg-gray-50 p-3 sm:grid-cols-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleSave(inv, event.currentTarget);
                  }}
                >
                  <input
                    name="property_count"
                    type="number"
                    min={1}
                    defaultValue={inv.property_count}
                    data-testid="admin-invitation-property-count"
                    className="border border-gray-300 px-2 py-1 text-xs"
                  />
                  <input
                    name="expires_at"
                    type="date"
                    required
                    defaultValue={inputDate(inv.courtesy_expires_at ?? inv.expires_at)}
                    data-testid="admin-invitation-expires-at"
                    className="border border-gray-300 px-2 py-1 text-xs"
                  />
                  <input
                    name="reason"
                    required
                    placeholder="Motivo da alteracao"
                    className="border border-gray-300 px-2 py-1 text-xs"
                  />
                  <button
                    type="submit"
                    disabled={savingId === inv.id}
                    className="bg-black px-3 py-1 text-xs text-white disabled:opacity-60"
                  >
                    {savingId === inv.id ? "Salvando..." : "Salvar cortesia"}
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
