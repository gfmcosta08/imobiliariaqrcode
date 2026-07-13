"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import type { PastedListingDraft } from "../lib/property-import/pasted-listing";

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
    return "Nao encontramos anuncios nessa pagina. Tente o link direto do imovel ou use o cadastro rapido.";
  }
  if (message === "site_blocked_cloudflare" || message.includes("site_blocked_cloudflare")) {
    return "Esse site nao liberou a leitura automatica. Voce pode colar o texto do anuncio ou cadastrar rapido.";
  }
  if (message === "all_listings_empty_or_unavailable") {
    return "Encontramos links na página, mas nenhum anúncio pôde ser lido. Tente a URL direta de um imóvel (/imovel/...) ou outro portal.";
  }
  if (
    message === "fetch failed" ||
    message === "extrator_unreachable" ||
    message === "extrator_timeout"
  ) {
    return "Serviço de extração inacessível do servidor de homologação. Verifique se o extrator está online e acessível externamente.";
  }
  if (message.startsWith("extrator_http_502") || message.startsWith("extrator_http_503")) {
    return "Serviço de extração indisponível no momento (502/503). Tente novamente em alguns minutos.";
  }
  if (message === "job_stale_or_interrupted" || message === "import_job_interrupted") {
    return "A importacao demorou demais. Tente uma URL por vez ou cadastre rapido.";
  }
  if (message === "parser_verified_failed") {
    return "Falha no parser homologado deste site. Não usamos extrator genérico para evitar dados incompatíveis — tente novamente ou outro anúncio.";
  }
  return message;
}

type ImportSiteResolve = {
  ok: boolean;
  hostname: string;
  siteId: string | null;
  displayName: string | null;
  tier: "verified" | "supported" | "experimental" | "unknown";
  message: string;
  allowGenericFallback: boolean;
};

type PasteImportResponse = {
  ok: boolean;
  draft?: PastedListingDraft;
  error?: string;
};

function badgeClassForTier(tier: ImportSiteResolve["tier"]): string {
  if (tier === "verified") return "border-green-200 bg-green-50 text-green-800";
  if (tier === "unknown") return "border-gray-200 bg-gray-50 text-gray-600";
  return "border-amber-200 bg-amber-50 text-amber-900";
}

function badgeLabelForTier(tier: ImportSiteResolve["tier"]): string {
  if (tier === "verified") return "Homologado";
  if (tier === "supported") return "Parser disponível";
  if (tier === "experimental") return "Experimental";
  return "Não homologado";
}

function mapMissingUrlDetail(detail?: string): string {
  if (detail === "no_url_fields" || detail === "urls_array_empty" || detail === "url_field_empty") {
    return "Nenhuma URL válida chegou ao servidor. Tente novamente.";
  }
  if (detail === "urls_items_invalid") {
    return "Formato de URLs inválido no pedido.";
  }
  if (detail === "all_urls_duplicate") {
    return "Todas as URLs enviadas são duplicadas.";
  }
  return "Nenhuma URL válida para importação.";
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
  const [urlResolves, setUrlResolves] = useState<Array<ImportSiteResolve | null>>([null]);
  const [pasteText, setPasteText] = useState("");
  const [pasteLoading, setPasteLoading] = useState(false);
  const [pasteDraft, setPasteDraft] = useState<PastedListingDraft | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resolveTimersRef = useRef<Array<ReturnType<typeof setTimeout> | null>>([]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  useEffect(() => {
    resolveTimersRef.current.forEach((timer) => {
      if (timer) clearTimeout(timer);
    });
    resolveTimersRef.current = urls.map((url, index) => {
      const trimmed = url.trim();
      if (!trimmed) {
        setUrlResolves((prev) => {
          const next = [...prev];
          next[index] = null;
          return next;
        });
        return null;
      }
      return setTimeout(() => {
        void (async () => {
          try {
            const res = await fetch(
              `/api/properties/import/resolve?url=${encodeURIComponent(trimmed)}`,
            );
            const data = (await res.json()) as {
              ok: boolean;
              resolve?: ImportSiteResolve;
            };
            setUrlResolves((prev) => {
              const next = [...prev];
              next[index] = data.resolve ?? null;
              return next;
            });
          } catch {
            setUrlResolves((prev) => {
              const next = [...prev];
              next[index] = null;
              return next;
            });
          }
        })();
      }, 300);
    });

    return () => {
      resolveTimersRef.current.forEach((timer) => {
        if (timer) clearTimeout(timer);
      });
    };
  }, [urls]);

  function resetDialog() {
    stopPolling();
    setOpen(false);
    setLoading(false);
    setJob(null);
    setError(null);
    setUrls(emptyUrlFields());
    setUrlResolves([null]);
    setPasteText("");
    setPasteLoading(false);
    setPasteDraft(null);
  }

  function addUrlField() {
    setUrls((prev) => (prev.length >= MAX_URL_FIELDS ? prev : [...prev, ""]));
    setUrlResolves((prev) => (prev.length >= MAX_URL_FIELDS ? prev : [...prev, null]));
  }

  function removeUrlField(index: number) {
    setUrls((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
    setUrlResolves((prev) => {
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
              ? (data.detail ?? "Serviço de extração não configurado no staging.")
              : data.error === "missing_url"
                ? mapMissingUrlDetail(data.detail)
                : data.error === "host_not_allowed"
                  ? "URL inválida ou não permitida para importação."
                  : data.error === "too_many_urls"
                    ? `Máximo de ${MAX_URL_FIELDS} URLs por importação.`
                    : data.detail
                      ? `${data.error ?? "erro"}: ${data.detail}`
                      : (data.error ?? "Não foi possível iniciar a importação.");
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

  async function handlePasteSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = pasteText.trim();
    if (!text) return;
    setPasteLoading(true);
    setError(null);
    setPasteDraft(null);

    try {
      const res = await fetch("/api/properties/import/paste", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = (await res.json()) as PasteImportResponse;
      if (!res.ok || !data.ok || !data.draft) {
        setError(
          data.error === "missing_text"
            ? "Cole o texto do anuncio antes de gerar o rascunho."
            : (data.error ?? "Nao foi possivel ler o texto colado."),
        );
        return;
      }
      setPasteDraft(data.draft);
    } catch {
      setError("Erro de conexao.");
    } finally {
      setPasteLoading(false);
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
          <div className="w-full max-w-lg max-h-[calc(100vh-8rem)] overflow-y-auto bg-white p-6 shadow-lg">
            <h2 id="import-dialog-title" className="text-lg font-semibold text-gray-900">
              Importar anúncios (homologação)
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Cole uma ou mais URLs de imóveis, listagens ou páginas iniciais de sites imobiliários
              (HTTPS). Máximo {MAX_URL_FIELDS} URLs e {MAX_URL_FIELDS} imóveis; todos entram como
              rascunho sem mapa até você informar a geolocalização.
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
                {urls.map((url, index) => {
                  const resolve = urlResolves[index];
                  return (
                    <div key={index} className="space-y-1">
                      <div className="flex gap-2">
                        <input
                          id={index === 0 ? "import-url" : undefined}
                          type="url"
                          required={index === 0}
                          placeholder="https://www.exemplo.com.br/imovel/..."
                          value={url}
                          onChange={(e) => updateUrlField(index, e.target.value)}
                          className="min-w-0 flex-1 border border-gray-300 px-3 py-2 text-sm"
                          disabled={loading}
                          data-testid={
                            index === 0 ? "import-listings-url" : `import-listings-url-${index}`
                          }
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
                      {resolve?.message ? (
                        <p
                          className={`flex flex-wrap items-center gap-2 border px-2 py-1 text-xs ${badgeClassForTier(resolve.tier)}`}
                          data-testid={`import-listings-resolve-${index}`}
                        >
                          <span className="font-medium">{badgeLabelForTier(resolve.tier)}</span>
                          <span>{resolve.message}</span>
                        </p>
                      ) : null}
                    </div>
                  );
                })}
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

            <form
              onSubmit={handlePasteSubmit}
              className="mt-5 border-t border-gray-200 pt-5"
              data-testid="import-paste-form"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Colar texto do anuncio</h3>
                  <p className="mt-1 text-xs text-gray-500">
                    Use quando o portal bloquear a URL ou quando o corretor so conseguir enviar o
                    texto copiado do anuncio.
                  </p>
                </div>
              </div>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={5}
                maxLength={20_000}
                className="mt-3 w-full border border-gray-300 px-3 py-2 text-sm"
                placeholder="Cole titulo, descricao, bairro, cidade, valor, quartos, banheiros e vagas."
                disabled={pasteLoading}
                data-testid="import-paste-text"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={pasteLoading || !pasteText.trim()}
                  className="bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
                  data-testid="import-paste-submit"
                >
                  {pasteLoading ? "Lendo..." : "Gerar rascunho"}
                </button>
                <a
                  href="/onboarding/primeiro-qr"
                  className="border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:border-gray-500"
                >
                  Usar cadastro rapido
                </a>
              </div>
              {pasteDraft ? (
                <div
                  className="mt-4 border border-gray-200 p-3 text-sm"
                  data-testid="import-paste-draft"
                >
                  <p className="font-medium text-gray-900">
                    {pasteDraft.title ?? "Titulo nao identificado"}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {[pasteDraft.neighborhood, pasteDraft.city].filter(Boolean).join(" / ") ||
                      "Localizacao nao identificada"}
                  </p>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                    <div>
                      <dt className="text-gray-400">Venda</dt>
                      <dd>
                        {pasteDraft.sale_price
                          ? pasteDraft.sale_price.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })
                          : "Nao informado"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-400">Aluguel</dt>
                      <dd>
                        {pasteDraft.rent_price
                          ? pasteDraft.rent_price.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })
                          : "Nao informado"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-400">Quartos</dt>
                      <dd>{pasteDraft.bedrooms ?? "Nao informado"}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-400">Banheiros</dt>
                      <dd>{pasteDraft.bathrooms ?? "Nao informado"}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-400">Vagas</dt>
                      <dd>{pasteDraft.parking_spaces ?? "Nao informado"}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-400">Area</dt>
                      <dd>{pasteDraft.area ? `${pasteDraft.area} m2` : "Nao informado"}</dd>
                    </div>
                  </dl>
                  {pasteDraft.description ? (
                    <p className="mt-3 line-clamp-3 text-xs text-gray-500">
                      {pasteDraft.description}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </form>

            {error ? (
              <p className="mt-3 text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}

            {job ? (
              <div
                className="mt-4 border border-gray-200 p-3 text-sm"
                data-testid="import-job-status"
              >
                <p>
                  Status: <strong>{job.status}</strong> ({job.processed_count}/
                  {job.total_count || "?"})
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
