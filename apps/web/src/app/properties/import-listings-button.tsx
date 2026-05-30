"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const MAX_URL_FIELDS = 10;

type ImportStartResponse = {
  ok: boolean;
  job_id?: string;
  poll_url?: string;
  error?: string;
  detail?: string;
};

type ImportJob = {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  mode: string;
  source_url: string;
  total_count: number;
  processed_count: number;
  error_message: string | null;
  results: Array<{
    source_url: string;
    status: string;
    property_id?: string;
    title?: string | null;
    error?: string;
    images_uploaded?: number;
  }>;
};

type Props = {
  enabled: boolean;
};

function humanizeImportError(message: string): string {
  const fetchBlocked = /^fetch_failed_(401|403|410|429|503)$/.exec(message);
  if (fetchBlocked) {
    const status = fetchBlocked[1];
    return `O site bloqueou a leitura automática (HTTP ${status}). Cole a URL direta de um anúncio individual (/imovel/...) ou tente outro portal.`;
  }
  if (message === "no_properties_found") {
    return "Nenhum imóvel encontrado nessa URL. Sites em React (ex.: Vivanci) costumam funcionar melhor com a página /imoveis ou o link direto de um anúncio (/imovel/...).";
  }
  if (message === "site_blocked_cloudflare" || message.includes("site_blocked_cloudflare")) {
    return "A OLX bloqueou a importação automática neste servidor. Cole manualmente os dados ou use outro portal.";
  }
  if (message === "all_listings_empty_or_unavailable") {
    return "Encontramos links na página, mas nenhum anúncio pôde ser lido. Tente a URL direta de um imóvel (/imovel/...) ou outro portal.";
  }
  if (message.startsWith("extrator_http_502") || message.startsWith("extrator_http_503")) {
    return "Serviço de extração indisponível no momento (502/503). Tente novamente em alguns minutos.";
  }
  return message;
}

function emptyUrlFields(): string[] {
  return [""];
}

export function ImportListingsButton({ enabled }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [urls, setUrls] = useState<string[]>(emptyUrlFields);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<ImportJob | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  function resetDialog() {
    stopPolling();
    setOpen(false);
    setLoading(false);
    setJob(null);
    setError(null);
    setUrls(emptyUrlFields());
  }

  function addUrlField() {
    setUrls((prev) => (prev.length >= MAX_URL_FIELDS ? prev : [...prev, ""]));
  }

  function removeUrlField(index: number) {
    setUrls((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }

  function updateUrlField(index: number, value: string) {
    setUrls((prev) => prev.map((item, i) => (i === index ? value : item)));
  }

  async function pollJob(jobId: string) {
    const res = await fetch(`/api/properties/import/${jobId}`);
    const data = (await res.json()) as { ok: boolean; job?: ImportJob; error?: string };
    if (!data.ok || !data.job) {
      setError(data.error ?? "Falha ao consultar importação.");
      stopPolling();
      setLoading(false);
      return;
    }
    setJob(data.job);
    if (data.job.status === "completed" || data.job.status === "failed") {
      stopPolling();
      setLoading(false);
      router.refresh();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = urls.map((u) => u.trim()).filter(Boolean);
    if (trimmed.length === 0) return;
    setLoading(true);
    setError(null);
    setJob(null);
    stopPolling();

    try {
      const res = await fetch("/api/properties/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ urls: trimmed }),
      });
      const data = (await res.json()) as ImportStartResponse;
      if (!data.ok || !data.job_id) {
        const msg =
          data.error === "feature_disabled"
            ? "Importação disponível apenas no ambiente de homologação."
            : data.error === "extrator_not_configured"
              ? data.detail ?? "Serviço de extração não configurado no staging."
              : data.error === "host_not_allowed"
                ? "URL inválida ou não permitida para importação."
                : data.error === "too_many_urls"
                  ? `Máximo de ${MAX_URL_FIELDS} URLs por importação.`
                  : data.error ?? "Não foi possível iniciar a importação.";
        setError(msg);
        setLoading(false);
        return;
      }

      pollRef.current = setInterval(() => {
        void pollJob(data.job_id as string);
      }, 2000);
      await pollJob(data.job_id);
    } catch {
      setError("Erro de conexão.");
      setLoading(false);
    }
  }

  if (!enabled) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border border-blue-600 px-5 py-2.5 text-sm font-medium text-blue-700 transition hover:bg-blue-50"
        data-testid="import-listings-open"
      >
        Importar anúncios
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-dialog-title"
        >
          <div className="w-full max-w-lg bg-white p-6 shadow-lg">
            <h2 id="import-dialog-title" className="text-lg font-semibold text-gray-900">
              Importar anúncios (homologação)
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Cole uma ou mais URLs de imóveis, listagens ou páginas iniciais de sites
              imobiliários (HTTPS). Máximo {MAX_URL_FIELDS} URLs e {MAX_URL_FIELDS} imóveis; todos
              entram como rascunho sem mapa até você informar a geolocalização.
            </p>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">URLs do site imobiliário</span>
                <button
                  type="button"
                  onClick={addUrlField}
                  disabled={loading || urls.length >= MAX_URL_FIELDS}
                  className="border border-gray-300 px-2 py-1 text-sm disabled:opacity-50"
                  aria-label="Adicionar URL"
                  data-testid="import-listings-add-url"
                >
                  +
                </button>
              </div>

              <div className="space-y-2">
                {urls.map((url, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      id={index === 0 ? "import-url" : undefined}
                      type="url"
                      required={index === 0}
                      placeholder="https://www.exemplo.com.br/imovel/..."
                      value={url}
                      onChange={(e) => updateUrlField(index, e.target.value)}
                      className="min-w-0 flex-1 border border-gray-300 px-3 py-2 text-sm"
                      disabled={loading}
                      data-testid={index === 0 ? "import-listings-url" : `import-listings-url-${index}`}
                    />
                    {urls.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeUrlField(index)}
                        disabled={loading}
                        className="border border-gray-300 px-2 py-2 text-sm disabled:opacity-50"
                        aria-label={`Remover URL ${index + 1}`}
                        data-testid={`import-listings-remove-url-${index}`}
                      >
                        −
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
                  data-testid="import-listings-submit"
                >
                  {loading ? "Importando…" : "Iniciar importação"}
                </button>
                <button
                  type="button"
                  onClick={resetDialog}
                  className="border border-gray-300 px-4 py-2 text-sm"
                >
                  Fechar
                </button>
              </div>
            </form>

            {error ? (
              <p className="mt-3 text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}

            {job ? (
              <div className="mt-4 border border-gray-200 p-3 text-sm" data-testid="import-job-status">
                <p>
                  Status: <strong>{job.status}</strong> ({job.processed_count}/{job.total_count || "?"})
                </p>
                {job.error_message ? (
                  <p className="mt-1 text-red-600">{humanizeImportError(job.error_message)}</p>
                ) : null}
                <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                  {(job.results ?? []).map((r) => (
                    <li key={r.source_url} className="text-xs text-gray-600">
                      {r.status === "ok" ? "✓" : "✗"} {r.title ?? r.source_url}
                      {r.property_id ? (
                        <a
                          href={`/properties/${r.property_id}`}
                          className="ml-2 text-blue-600 underline"
                        >
                          abrir
                        </a>
                      ) : null}
                      {typeof r.images_uploaded === "number"
                        ? ` — ${r.images_uploaded} foto(s)`
                        : null}
                      {r.error ? ` — ${humanizeImportError(r.error)}` : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
