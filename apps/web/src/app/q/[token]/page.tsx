"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type State =
  | { loading: true }
  | { loading: false; body: Record<string, unknown> }
  | { loading: false; error: string };

export default function PublicQrPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;
  const [state, setState] = useState<State>({ loading: true });

  useEffect(() => {
    if (!token) {
      setState({ loading: false, error: "Token ausente." });
      return;
    }
    let cancelled = false;
    (async () => {
      const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
      if (!base) {
        setState({ loading: false, error: "NEXT_PUBLIC_SUPABASE_URL não configurada." });
        return;
      }
      try {
        const res = await fetch(
          `${base}/functions/v1/qr-resolve?token=${encodeURIComponent(token)}`,
          {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          },
        );
        const body = (await res.json()) as Record<string, unknown>;
        if (!cancelled) {
          setState({ loading: false, body });
        }
      } catch (e) {
        if (!cancelled) {
          setState({ loading: false, error: e instanceof Error ? e.message : String(e) });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Carregando…</p>
      </div>
    );
  }

  if ("error" in state && state.error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
        <p className="text-sm text-red-600">{state.error}</p>
      </div>
    );
  }

  const body = "body" in state ? state.body : {};
  const message =
    typeof body.message === "string" ? body.message : "Este anúncio não está mais disponível.";
  const ok = body.ok === true;
  const st = typeof body.state === "string" ? body.state : "unknown";

  if (!ok || st === "not_found") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 text-center dark:bg-zinc-950">
        <p className="text-lg font-medium text-zinc-900 dark:text-zinc-50">QR inválido</p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Não encontramos este anúncio.
        </p>
      </div>
    );
  }

  if (st === "expired" || st === "unavailable") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 text-center dark:bg-zinc-950">
        <p className="text-lg font-medium text-zinc-900 dark:text-zinc-50">{message}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 text-center dark:bg-zinc-950">
      <p className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Anúncio encontrado</p>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Próximo passo no SDD: abrir conversa no WhatsApp (Uazapi + fila).
      </p>
      <pre className="mt-6 max-w-lg overflow-x-auto rounded-lg bg-zinc-100 p-4 text-left text-xs text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
        {JSON.stringify(body, null, 2)}
      </pre>
    </div>
  );
}
