"use client";

import { useState } from "react";

type QrCode = { is_active: boolean };
type BrokerProfile = { email: string; full_name: string | null };
type Broker = {
  id: string;
  profile_id: string | null;
  display_name: string | null;
  profiles: BrokerProfile | BrokerProfile[] | null;
};
type Property = {
  id: string;
  public_id: string | null;
  title: string | null;
  internal_code: string | null;
  listing_status: string;
  expires_at: string | null;
  city: string | null;
  state: string | null;
  brokers: Broker | null;
  property_qrcodes: QrCode[] | null;
};

const LISTING_STATUSES = [
  "draft",
  "published",
  "printed",
  "expired",
  "removed",
  "blocked",
  "reserved",
];

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function brokerLabel(broker: Broker | null): string {
  if (!broker) return "Perfil de corretor nao encontrado";
  const profile = Array.isArray(broker.profiles) ? broker.profiles[0] : broker.profiles;
  return profile?.email ?? broker.display_name ?? `perfil ${broker.profile_id ?? broker.id}`;
}

export function PropertiesManager() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Property[]>([]);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Property | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editExpiresAt, setEditExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSearch() {
    if (!query.trim()) return;
    setFetching(true);
    setFetchError(null);
    setResults([]);
    try {
      const res = await fetch(`/api/admin/properties?q=${encodeURIComponent(query.trim())}`);
      const data = (await res.json()) as { ok: boolean; data: Property[]; error?: string };
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

  function startEdit(prop: Property) {
    setEditing(prop);
    setEditStatus(prop.listing_status);
    setEditExpiresAt(toDateInputValue(prop.expires_at));
    setSaveMsg(null);
    setSaveError(null);
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    setSaveError(null);
    setSaveMsg(null);
    try {
      const body: Record<string, unknown> = { listing_status: editStatus };
      if (editExpiresAt) {
        body.expires_at = new Date(editExpiresAt).toISOString();
      } else {
        body.expires_at = null;
      }
      const res = await fetch(`/api/admin/properties/${editing.id}`, {
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
        prev.map((p) =>
          p.id === editing.id
            ? {
                ...p,
                listing_status: editStatus,
                expires_at: editExpiresAt ? new Date(editExpiresAt).toISOString() : null,
              }
            : p,
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
      {/* Busca */}
      <div className="flex gap-3">
        <input
          type="text"
          data-testid="admin-properties-search"
          placeholder="Buscar por public_id, codigo interno ou titulo..."
          className="flex-1 border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <button
          onClick={handleSearch}
          disabled={fetching || !query.trim()}
          data-testid="admin-properties-search-submit"
          className="bg-black px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {fetching ? "Buscando..." : "Buscar"}
        </button>
      </div>

      {fetchError && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2">{fetchError}</p>
      )}

      {/* Resultados */}
      {results.length > 0 && (
        <div className="space-y-3">
          {results.map((prop) => {
            const qrActive = prop.property_qrcodes?.some((q) => q.is_active);
            const brokerEmail = brokerLabel(prop.brokers);
            return (
              <div
                key={prop.id}
                data-testid="admin-properties-result"
                className="border border-gray-200 p-4 flex items-start justify-between gap-4"
              >
                <div>
                  <p className="font-semibold text-gray-900">
                    {prop.title ?? prop.public_id ?? prop.id}
                    {prop.public_id && (
                      <span className="ml-2 text-xs font-normal text-gray-400">
                        ({prop.public_id})
                      </span>
                    )}
                    {prop.internal_code ? (
                      <span className="ml-2 text-xs font-normal text-gray-400">
                        Cod. interno: {prop.internal_code}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {prop.city ?? "—"} / {prop.state ?? "—"} ·{" "}
                    <span className="font-medium">{prop.listing_status}</span> · validade:{" "}
                    {fmtDate(prop.expires_at)}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    Corretor: {brokerEmail} · QR Code:{" "}
                    {qrActive ? (
                      <span className="text-green-600">ativo</span>
                    ) : (
                      <span className="text-red-500">inativo</span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => startEdit(prop)}
                  data-testid="admin-properties-edit"
                  className="flex-shrink-0 border border-gray-300 px-4 py-1.5 text-xs text-gray-700 transition hover:border-gray-500"
                >
                  Editar
                </button>
              </div>
            );
          })}
        </div>
      )}

      {results.length === 0 && !fetching && !fetchError && (
        <p className="text-sm text-gray-400">
          Busque por public_id (ex: IMV-2026-BD5699), codigo interno ou parte do titulo.
        </p>
      )}

      {/* Modal de edição */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          data-testid="admin-properties-modal"
        >
          <div className="w-full max-w-md bg-white p-6 shadow-xl">
            <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">
              Editar anúncio
            </h3>
            <p className="mt-1 text-sm font-medium text-gray-900">
              {editing.title ?? editing.public_id ?? editing.id}
            </p>

            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="text-xs text-gray-500">Status</span>
                <select
                  data-testid="admin-properties-edit-status"
                  className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                >
                  {LISTING_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs text-gray-500">Data de expiração (deixe vazio para sem expiração)</span>
                <input
                  type="date"
                  data-testid="admin-properties-edit-expires-at"
                  className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
                  value={editExpiresAt}
                  onChange={(e) => setEditExpiresAt(e.target.value)}
                />
              </label>
            </div>

            <p className="mt-3 text-xs text-gray-400">
              Mudar para published/printed → reativa QR Code. Mudar para expired/removed → desativa QR Code.
            </p>

            {saveError && (
              <p className="mt-3 text-sm text-red-600 bg-red-50 px-3 py-2">{saveError}</p>
            )}
            {saveMsg && (
              <p className="mt-3 text-sm text-green-600">{saveMsg}</p>
            )}

            <div className="mt-5 flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                data-testid="admin-properties-edit-save"
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
