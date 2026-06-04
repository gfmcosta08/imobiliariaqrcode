"use client";

import { useState } from "react";

type PendingInvitation = {
  id: string;
  login_code: string;
  status: string;
  generated_at: string;
  expires_at: string | null;
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
  const [editPropertyCount, setEditPropertyCount] = useState("1");
  const [editExpiresAt, setEditExpiresAt] = useState("");
  const [error, setError] = useState<string | null>(null);

  function toDateInput(value: string | null): string {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
  }

  function startEdit(invitation: PendingInvitation) {
    setEditingId(invitation.id);
    setEditPropertyCount(String(invitation.property_count));
    setEditExpiresAt(toDateInput(invitation.expires_at));
    setError(null);
  }

  async function handleSave(invitation: PendingInvitation) {
    setSavingId(invitation.id);
    setError(null);

    try {
      const res = await fetch("/api/admin/invitations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: invitation.id,
          property_count: Number(editPropertyCount),
          expires_at: editExpiresAt,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        detail?: string;
        invitation?: PendingInvitation;
      };

      if (!res.ok || !data.ok || !data.invitation) {
        setError(
          data.detail
            ? `${data.error}: ${data.detail}`
            : (data.error ?? "Falha ao salvar convite."),
        );
        return;
      }

      setItems((prev) =>
        prev.map((item) =>
          item.id === invitation.id
            ? {
                ...item,
                ...data.invitation,
                property_count: Number(data.invitation?.property_count ?? item.property_count),
                expiration_days_configured: Number(
                  data.invitation?.expiration_days_configured ?? item.expiration_days_configured,
                ),
              }
            : item,
        ),
      );
      setEditingId(null);
    } catch {
      setError("Erro de conexao ao salvar convite.");
    } finally {
      setSavingId(null);
    }
  }

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
          data.detail
            ? `${data.error}: ${data.detail}`
            : (data.error ?? "Falha ao excluir convite."),
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

  return (
    <div className="mt-12 border border-gray-200 p-6">
      <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">
        Convites gerados
      </h3>

      {error ? <p className="mt-4 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-gray-400">Nenhum convite gerado.</p>
      ) : (
        <ul className="mt-4 divide-y divide-gray-100" data-testid="admin-invitations-list">
          {items.map((inv) => (
            <li
              key={inv.id}
              className="flex flex-col gap-3 py-3 md:flex-row md:items-center md:justify-between"
              data-testid="admin-invitation-item"
            >
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
                  <span className="ml-3 text-xs text-gray-400">
                    Ativado: {formatDate(inv.claimed_at)}
                  </span>
                ) : null}
                {inv.completed_at ? (
                  <span className="ml-3 text-xs text-gray-400">
                    Concluido: {formatDate(inv.completed_at)}
                  </span>
                ) : null}
                {editingId === inv.id ? (
                  <div className="mt-3 flex flex-wrap gap-3">
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Imoveis
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={editPropertyCount}
                        onChange={(event) => setEditPropertyCount(event.target.value)}
                        data-testid="admin-invitation-property-count"
                        className="mt-1 block w-24 border border-gray-200 px-2 py-2 text-sm font-normal normal-case tracking-normal text-gray-900"
                      />
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Validade
                      <input
                        type="date"
                        value={editExpiresAt}
                        onChange={(event) => setEditExpiresAt(event.target.value)}
                        data-testid="admin-invitation-expires-at"
                        className="mt-1 block border border-gray-200 px-2 py-2 text-sm font-normal normal-case tracking-normal text-gray-900"
                      />
                    </label>
                  </div>
                ) : null}
              </div>

              <div className="flex items-center gap-3 self-start md:self-center">
                <span
                  className={`text-xs font-semibold uppercase tracking-wide ${statusClass(inv.status)}`}
                  data-testid="admin-invitation-status"
                >
                  {statusLabel(inv.status)}
                </span>
                {inv.status === "pending" ? (
                  editingId === inv.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleSave(inv)}
                        disabled={savingId === inv.id}
                        className="border border-gray-900 bg-gray-900 px-3 py-1 text-xs text-white transition hover:bg-black disabled:opacity-60"
                      >
                        {savingId === inv.id ? "Salvando..." : "Salvar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="border border-gray-300 px-3 py-1 text-xs text-gray-700 transition hover:bg-gray-50"
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => startEdit(inv)}
                        data-testid="admin-invitation-edit"
                        className="border border-gray-300 px-3 py-1 text-xs text-gray-700 transition hover:bg-gray-50"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(inv)}
                        disabled={deletingId === inv.id}
                        data-testid="admin-invitation-cancel"
                        className="border border-red-300 px-3 py-1 text-xs text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                      >
                        {deletingId === inv.id ? "Cancelando..." : "Cancelar"}
                      </button>
                    </>
                  )
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
