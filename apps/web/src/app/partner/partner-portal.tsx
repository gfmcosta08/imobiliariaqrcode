"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type LookupOk = {
  ok: true;
  property_id: string;
  public_id: string;
  title: string | null;
  city: string;
  state: string;
  listing_status: string;
};

export function PartnerPortal() {
  const [publicId, setPublicId] = useState("");
  const [result, setResult] = useState<LookupOk | null>(null);
  const [rpcError, setRpcError] = useState<string | null>(null);
  const [printMsg, setPrintMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onLookup(e: React.FormEvent) {
    e.preventDefault();
    setRpcError(null);
    setPrintMsg(null);
    setResult(null);
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("partner_lookup_property", {
      p_public_id: publicId.trim(),
    });
    setLoading(false);
    if (error) {
      setRpcError(error.message);
      return;
    }
    const payload = data as { ok?: boolean; reason?: string } & Partial<LookupOk>;
    if (payload && payload.ok === true && payload.property_id) {
      setResult(payload as LookupOk);
      return;
    }
    setRpcError("Imóvel não encontrado.");
  }

  async function onRegisterPrint() {
    if (!result?.property_id) return;
    setPrintMsg(null);
    setLoading(true);
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!session?.access_token || !base || !anon) {
      setLoading(false);
      setPrintMsg("Sessão ou variáveis de ambiente ausentes.");
      return;
    }
    const res = await fetch(`${base}/functions/v1/partner-print-register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: anon,
      },
      body: JSON.stringify({ property_id: result.property_id }),
    });
    const body = (await res.json()) as {
      ok?: boolean;
      detail?: string;
      printed_at?: string | null;
    };
    setLoading(false);
    if (!res.ok) {
      setPrintMsg(body?.detail ?? `Erro HTTP ${res.status}`);
      return;
    }
    setPrintMsg("Impressão registrada com sucesso.");
  }

  return (
    <div className="mt-8 space-y-6">
      <form onSubmit={onLookup} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Public ID</span>
          <input
            value={publicId}
            onChange={(e) => setPublicId(e.target.value)}
            placeholder="IMV-2026-XXXXXX"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            required
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-zinc-900 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          {loading ? "Buscando…" : "Buscar"}
        </button>
      </form>

      {rpcError ? (
        <p className="text-sm text-red-600" role="alert">
          {rpcError}
        </p>
      ) : null}

      {result ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="font-medium text-zinc-900 dark:text-zinc-50">
            {result.title ?? result.public_id}
          </p>
          <p className="text-zinc-600 dark:text-zinc-400">
            {result.city} / {result.state} · {result.listing_status}
          </p>
          <button
            type="button"
            onClick={onRegisterPrint}
            disabled={loading}
            className="mt-4 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-600"
          >
            Registrar impressão
          </button>
          {printMsg ? <p className="mt-2 text-zinc-700 dark:text-zinc-300">{printMsg}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
