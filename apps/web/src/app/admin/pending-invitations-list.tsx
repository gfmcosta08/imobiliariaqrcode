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
              className="flex items-center justify-between py-3"
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
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`text-xs font-semibold uppercase tracking-wide ${statusClass(inv.status)}`}
                  data-testid="admin-invitation-status"
                >
                  {statusLabel(inv.status)}
                </span>
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
