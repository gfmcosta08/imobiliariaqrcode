"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { updatePropertyStatus } from "../actions";

const statuses = [
  { value: "draft", label: "Rascunho" },
  { value: "published", label: "Publicado" },
  { value: "printed", label: "Impresso" },
  { value: "removed", label: "Removido" },
];

export function StatusForm(props: { propertyId: string; currentStatus: string }) {
  const router = useRouter();
  const [status, setStatus] = useState(props.currentStatus);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSave() {
    setError(null);
    setLoading(true);
    const res = await updatePropertyStatus(props.propertyId, status);
    setLoading(false);
    if (res && "error" in res && res.error) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-800 dark:text-zinc-200">Status do anúncio</span>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        >
          {statuses.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={onSave}
        disabled={loading || status === props.currentStatus}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {loading ? "Salvando…" : "Atualizar status"}
      </button>
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
