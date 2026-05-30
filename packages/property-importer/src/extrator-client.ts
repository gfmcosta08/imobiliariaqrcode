import { MAX_PROPERTIES_PER_IMPORT } from "./constants";
import type { ExtratorExtractResponse, ExtratorListing } from "./extrator-types";
import { validateImportUrl } from "./ssrf";

export type ExtractOptions = {
  maxImages?: number;
  downloadImages?: boolean;
};

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
  const res = await fetch(`${base}/v1/extract`, {
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

  const res = await fetch(`${base}/v1/discover`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: pageUrl }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!res.ok) return null;

  const body = (await res.json()) as ExtratorDiscoverResponse;
  if (!body.ok || typeof body.html !== "string") return null;
  return body.html;
}
