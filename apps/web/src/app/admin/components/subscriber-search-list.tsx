"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { SubscriberRow } from "@/lib/admin/types";

type Props = {
  initialQuery: string;
};

export function SubscriberSearchList({ initialQuery }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [rows, setRows] = useState<SubscriberRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRows = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/admin/metrics/subscribers?${params}`);
      const json = (await res.json()) as { ok: boolean; data?: SubscriberRow[]; error?: string };
      if (!json.ok) {
        setError(json.error ?? "Erro ao buscar assinantes");
        setRows([]);
        return;
      }
      setRows(json.data ?? []);
    } catch {
      setError("Erro de conexão");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRows(initialQuery);
  }, [fetchRows, initialQuery]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = new URL(window.location.href);
    if (query.trim()) {
      url.searchParams.set("q", query.trim());
    } else {
      url.searchParams.delete("q");
    }
    window.history.replaceState({}, "", url.toString());
    void fetchRows(query);
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="flex flex-wrap gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nome, e-mail, telefone ou UUID da conta..."
          className="min-w-[280px] flex-1 border border-gray-300 px-4 py-2 text-sm text-gray-900"
        />
        <button
          type="submit"
          disabled={loading}
          className="border border-gray-900 bg-gray-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Buscando..." : "Buscar"}
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && rows.length === 0 && (
        <p className="text-sm text-gray-500">Nenhum assinante encontrado.</p>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto border border-gray-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Assinante</th>
                <th className="px-4 py-3">Conta</th>
                <th className="px-4 py-3">Plano</th>
                <th className="px-4 py-3">Imóveis</th>
                <th className="px-4 py-3">Leituras QR</th>
                <th className="px-4 py-3">Leads</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr key={row.account_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{row.full_name}</p>
                    <p className="text-xs text-gray-500">{row.email}</p>
                    <p className="text-xs text-gray-400">{row.whatsapp_number || "—"}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">
                    {row.account_id.slice(0, 8)}…
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-gray-900">{row.plan_code}</span>
                    <span className="ml-2 text-xs text-gray-400">{row.subscription_status}</span>
                  </td>
                  <td className="px-4 py-3">{row.total_properties}</td>
                  <td className="px-4 py-3">{row.total_qr_reads}</td>
                  <td className="px-4 py-3">{row.total_leads}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/subscribers/${row.account_id}`}
                      className="text-sm font-medium text-gray-900 underline"
                    >
                      Ver dashboard
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
