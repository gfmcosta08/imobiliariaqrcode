"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type LeadProperty = { public_id: string | null; city: string | null; state: string | null } | null;
type Lead = {
  id: string;
  client_phone: string;
  client_name: string | null;
  intent: string;
  status: string;
  source: string | null;
  notes: string | null;
  broker_notes: string | null;
  created_at: string;
  property: LeadProperty;
};

type LeadFormData = {
  client_name: string;
  notes: string;
  broker_notes: string;
  status: string;
};

const STATUS_OPTIONS = ["new", "contacted", "scheduled", "closed", "invalid"];

const STATUS_LABELS: Record<string, string> = {
  new: "Novo",
  contacted: "Contatado",
  scheduled: "Agendado",
  closed: "Fechado",
  invalid: "Inválido",
};

function EditModal({ lead, onClose, onSave }: { lead: Lead; onClose: () => void; onSave: (updated: Lead) => void }) {
  const [formData, setFormData] = useState<LeadFormData>({
    client_name: lead.client_name ?? "",
    notes: lead.notes ?? "",
    broker_notes: lead.broker_notes ?? "",
    status: lead.status,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.error ?? "Erro ao salvar");
        setSaving(false);
        return;
      }

      onSave({ ...lead, ...formData });
      onClose();
    } catch {
      setError("Erro de conexão");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Editar Lead</h2>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Nome
            </label>
            <input
              type="text"
              value={formData.client_name}
              onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              placeholder="Nome completo do lead"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Observações
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              placeholder="Observações sobre o lead..."
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Notas privadas do corretor
            </label>
            <textarea
              value={formData.broker_notes}
              onChange={(e) => setFormData({ ...formData, broker_notes: e.target.value })}
              rows={2}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              placeholder="Notas privadas..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LeadsPage() {
  const supabase = createClient();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);

  async function fetchLeads() {
    setLoading(true);
    const { data, error } = await supabase
      .from("leads")
      .select("id, client_name, client_phone, intent, status, source, notes, broker_notes, created_at, property:properties (public_id, city, state)")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      setError(error.message);
    } else {
      setLeads((data ?? []).map((l: Lead & { property: LeadProperty | LeadProperty[] }) => ({
        ...l,
        property: Array.isArray(l.property) ? (l.property as LeadProperty[])[0] ?? null : l.property,
      })));
    }
    setLoading(false);
  }

  useState(() => {
    fetchLeads();
  });

  function handleSaveLead(updated: Lead) {
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <p className="text-zinc-500">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Leads</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Inclui interesses registrados pela página pública do QR. Automação Uazapi e cobrança online
        entram depois.
      </p>

      {error ? (
        <p className="mt-4 text-sm text-red-600" role="alert">{error}</p>
      ) : null}

      <ul className="mt-6 space-y-3">
        {leads.length === 0 ? (
          <li className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
            Nenhum lead ainda.
          </li>
        ) : (
          leads.map((l) => {
            const prop = l.property;
            return (
              <li
                key={l.id}
                className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-zinc-900 dark:text-zinc-50">
                      {l.client_name ?? l.client_phone}
                      {l.client_name && <span className="ml-2 text-sm text-zinc-500">({l.client_phone})</span>}
                    </p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {prop?.public_id ?? "—"} · {prop?.city ?? "—"} / {prop?.state ?? "—"}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {l.intent} · <span className={l.status === "new" ? "text-blue-600" : l.status === "closed" ? "text-green-600" : "text-zinc-400"}>{STATUS_LABELS[l.status] ?? l.status}</span> · {new Date(l.created_at).toLocaleString("pt-BR")}
                    </p>
                    {l.notes && (
                      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 italic">
                        {l.notes.length > 80 ? `${l.notes.slice(0, 80)}...` : l.notes}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setEditingLead(l)}
                    className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Editar
                  </button>
                </div>
              </li>
            );
          })
        )}
      </ul>

      <p className="mt-10 text-sm">
        <Link href="/dashboard" className="text-zinc-600 underline dark:text-zinc-400">
          Painel
        </Link>
      </p>

      {editingLead && (
        <EditModal
          lead={editingLead}
          onClose={() => setEditingLead(null)}
          onSave={handleSaveLead}
        />
      )}
    </div>
  );
}