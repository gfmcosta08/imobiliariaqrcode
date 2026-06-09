import { MAX_PROPERTIES_PER_IMPORT } from "./constants";
import type { ExtratorExtractResponse, ExtratorListing } from "./extrator-types";
import { validateImportUrl } from "./ssrf";

export type ExtractOptions = {
  maxImages?: number;
  downloadImages?: boolean;
};

function isAbortOrTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const name = error.name;
  const message = error.message.toLowerCase();
  return (
    name === "AbortError" ||
    name === "TimeoutError" ||
    message.includes("timeout") ||
    message.includes("aborted")
  );
}

/** Normaliza falhas de rede/timeout do fetch ao extrator para códigos estáveis. */
export function normalizeExtratorFetchError(error: unknown): string {
  if (error instanceof Error) {
    if (isAbortOrTimeoutError(error)) return "extrator_timeout";
    if (error.message === "fetch failed" || error.message.toLowerCase().includes("fetch failed")) {
      return "extrator_unreachable";
    }
    if (error.message.startsWith("extrator_http_")) return error.message;
    if (
      error.message.startsWith("extrator_") ||
      error.message === "invalid_url" ||
      error.message === "host_not_allowed"
    ) {
      return error.message;
    }
  }
  return "extrator_unreachable";
}

function wrapExtratorFetchError(error: unknown): never {
  throw new Error(normalizeExtratorFetchError(error));
}

export async function extractListingsFromUrls(
  urls: string[],
  options: {
    extratorBaseUrl: string;
    extractOptions?: ExtractOptions;
  },
): Promise<ExtratorExtractResponse["results"]> {
  const base = options.extratorBaseUrl.replace(/\/+$/, "");
  for (const url of urls) {
    const v = validateImportUrl(url);
    if (!v.ok) throw new Error(v.error);
  }

  const limited = urls.slice(0, MAX_PROPERTIES_PER_IMPORT);
  let res: Response;
  try {
    res = await fetch(`${base}/v1/extract`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        urls: limited,
        options: {
          includeHtml: false,
          includeText: true,
          downloadImages: options.extractOptions?.downloadImages ?? false,
          maxImages: options.extractOptions?.maxImages ?? 10,
        },
      }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (error) {
    wrapExtratorFetchError(error);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`extrator_http_${res.status}:${text.slice(0, 200)}`);
  }

  const body = (await res.json()) as ExtratorExtractResponse;
  if (!body.ok || !Array.isArray(body.results)) {
    throw new Error("extrator_invalid_response");
  }

  return body.results;
}

export function listingFromResult(
  result: ExtratorExtractResponse["results"][number],
): ExtratorListing | null {
  if (!result.ok) return null;
  return result.listing;
}

export type ExtratorDiscoverResponse =
  | { ok: true; url: string; html: string }
  | { ok: false; error: { message: string } };

export async function fetchRenderedHtmlFromExtrator(
  extratorBaseUrl: string,
  pageUrl: string,
): Promise<string | null> {
  const base = extratorBaseUrl.replace(/\/+$/, "");
  const v = validateImportUrl(pageUrl);
  if (!v.ok) return null;

  let res: Response;
  try {
    res = await fetch(`${base}/v1/discover`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: pageUrl }),
      signal: AbortSignal.timeout(90_000),
    });
  } catch {
    return null;
  }

  if (!res.ok) return null;

  const body = (await res.json()) as ExtratorDiscoverResponse;
  if (!body.ok || typeof body.html !== "string") return null;
  return body.html;
}

export type ExtratorProbeResult =
  | { extrator: "ok"; latencyMs: number; httpStatus: number }
  | { extrator: "unreachable"; detail: string; latencyMs?: number }
  | { extrator: "skipped"; detail: string };

/** Probe de conectividade Vercel → extrator (staging/diagnóstico). */
export async function probeExtratorConnectivity(
  extratorBaseUrl: string,
  options?: { timeoutMs?: number },
): Promise<ExtratorProbeResult> {
  const base = extratorBaseUrl.replace(/\/+$/, "");
  const timeoutMs = options?.timeoutMs ?? 10_000;
  const started = Date.now();

  try {
    const res = await fetch(`${base}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const latencyMs = Date.now() - started;
    if (res.ok || res.status === 404) {
      return { extrator: "ok", latencyMs, httpStatus: res.status };
    }
    return {
      extrator: "ok",
      latencyMs,
      httpStatus: res.status,
    };
  } catch (error) {
    const latencyMs = Date.now() - started;
    const detail = error instanceof Error ? error.message : "unknown";
    return { extrator: "unreachable", detail, latencyMs };
  }
}
