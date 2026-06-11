import type { ExtratorListing } from "../../extrator-types";
import { cleanDescription } from "../html-helpers";
import { normalizeImportImageUrl, isPropertyImportImageUrl } from "../../import-image-url";

const VIVANCI_ORIGIN = "https://vivanci.com";
const VIVANCI_SUPABASE_HOST = "tyqawceqowjmzgujrptx.supabase.co";
const VIVANCI_SUPABASE_BASE = `https://${VIVANCI_SUPABASE_HOST}`;
const FETCH_TIMEOUT_MS = 25_000;

let cachedAnonKey: string | null = null;

/** Limpa cache em memoria (uso exclusivo em testes). */
export function resetVivanciApiCacheForTests(): void {
  cachedAnonKey = null;
}

type VivanciImovelRow = {
  id: string;
  codigo?: string | null;
  titulo?: string | null;
  descricao?: string | null;
  end_cidade?: string | null;
  end_estado?: string | null;
  end_bairro?: string | null;
  qtd_quartos?: number | null;
  qtd_banheiro?: number | null;
  qtd_suites?: number | null;
  qtd_vagas?: number | null;
  area_privativa?: number | null;
  area_total?: number | null;
  valor_venda?: number | null;
  valor_aluguel?: number | null;
};

type VivanciFotoRow = {
  url?: string | null;
  url_medium?: string | null;
  principal?: boolean | null;
  ordem?: number | null;
};

export function extractVivanciCodigoFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url).pathname.replace(/\/+$/, "");
    const match = pathname.match(/\/imovel\/(\d{3,})$/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; ImobQR-Import/1.0; +https://farollimoveis-staging.vercel.app)",
        accept: "*/*",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

/** Anon key publicada no bundle JS do Vivanci (client-*.js). */
export async function fetchVivanciSupabaseAnonKey(): Promise<string | null> {
  if (cachedAnonKey) return cachedAnonKey;

  const homeHtml = await fetchText(`${VIVANCI_ORIGIN}/`);
  if (!homeHtml) return null;

  const clientFromHome = homeHtml.match(/\/assets\/client-[A-Za-z0-9_-]+\.js/);
  if (clientFromHome) {
    const key = await extractJwtFromClientBundle(clientFromHome[0]);
    if (key) {
      cachedAnonKey = key;
      return key;
    }
  }

  const indexMatch = homeHtml.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/);
  if (!indexMatch) return null;

  const indexJs = await fetchText(`${VIVANCI_ORIGIN}${indexMatch[0]}`);
  if (!indexJs) return null;

  const clientMatch =
    indexJs.match(/\/assets\/client-[A-Za-z0-9_-]+\.js/) ??
    indexJs.match(/["']assets\/client-[A-Za-z0-9_-]+\.js["']/);
  if (!clientMatch) return null;

  const clientPath = clientMatch[0].replace(/^["']|["']$/g, "").replace(/^(?!\/)/, "/");

  const key = await extractJwtFromClientBundle(clientPath);
  if (!key) return null;

  cachedAnonKey = key;
  return cachedAnonKey;
}

async function extractJwtFromClientBundle(clientPath: string): Promise<string | null> {
  const normalizedPath = clientPath.startsWith("/") ? clientPath : `/${clientPath}`;
  const clientJs = await fetchText(`${VIVANCI_ORIGIN}${normalizedPath}`);
  if (!clientJs) return null;

  const jwtMatch = clientJs.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  return jwtMatch?.[0] ?? null;
}

function supabaseHeaders(anonKey: string): Record<string, string> {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    Accept: "application/json",
  };
}

function formatMoney(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  return String(value);
}

function mapImovelRow(row: VivanciImovelRow): Partial<ExtratorListing> {
  const full_description = cleanDescription(row.descricao ?? "");
  const sale = row.valor_venda;
  const rent = row.valor_aluguel;
  const purpose: "" | "sale" | "rent" =
    sale != null && sale > 0 ? "sale" : rent != null && rent > 0 ? "rent" : "";

  return {
    title: row.titulo?.trim() ?? "",
    description: full_description,
    full_description,
    internal_code: row.codigo?.trim() ?? "",
    city: row.end_cidade?.trim() ?? "",
    state: row.end_estado?.trim() ?? "",
    neighborhood: row.end_bairro?.trim() ?? "",
    bedrooms: row.qtd_quartos ?? null,
    bathrooms: row.qtd_banheiro ?? null,
    suites: row.qtd_suites ?? null,
    parking_spaces: row.qtd_vagas ?? null,
    area_m2:
      row.area_privativa != null
        ? String(row.area_privativa)
        : row.area_total != null
          ? String(row.area_total)
          : "",
    sale_price: purpose !== "rent" ? formatMoney(sale) : "",
    rent_price: purpose === "rent" ? formatMoney(rent) : "",
    purpose,
  };
}

function mapFotoRows(rows: VivanciFotoRow[]): Array<{ url: string }> {
  const seen = new Set<string>();
  const images: Array<{ url: string }> = [];

  const sorted = [...rows].sort((a, b) => {
    const pa = a.principal ? 1 : 0;
    const pb = b.principal ? 1 : 0;
    if (pa !== pb) return pb - pa;
    return (a.ordem ?? 0) - (b.ordem ?? 0);
  });

  for (const row of sorted) {
    const raw = row.url?.trim() || row.url_medium?.trim() || "";
    if (!raw) continue;
    const normalized = normalizeImportImageUrl(raw);
    if (!isPropertyImportImageUrl(normalized, "vivanci.com")) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    images.push({ url: normalized });
  }

  return images;
}

/**
 * Busca dados completos do imóvel via REST público do Supabase (mesma API do site).
 * Retorna descrição integral e todas as fotos cadastradas.
 */
export async function fetchVivanciListingFromApi(
  pageUrl: string,
): Promise<Partial<ExtratorListing> | null> {
  const codigo = extractVivanciCodigoFromUrl(pageUrl);
  if (!codigo) return null;

  const anonKey = await fetchVivanciSupabaseAnonKey();
  if (!anonKey) return null;

  const imovelUrl =
    `${VIVANCI_SUPABASE_BASE}/rest/v1/imoveis_internos` +
    `?select=id,codigo,titulo,descricao,end_cidade,end_estado,end_bairro,qtd_quartos,qtd_banheiro,qtd_suites,qtd_vagas,area_privativa,area_total,valor_venda,valor_aluguel` +
    `&codigo=eq.${encodeURIComponent(codigo)}&ativo=eq.true`;

  let imovelRes: Response;
  try {
    imovelRes = await fetch(imovelUrl, {
      headers: supabaseHeaders(anonKey),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    return null;
  }

  if (!imovelRes.ok) return null;

  const imoveis = (await imovelRes.json()) as VivanciImovelRow[];
  const imovel = imoveis[0];
  if (!imovel?.id) return null;

  const fotosUrl =
    `${VIVANCI_SUPABASE_BASE}/rest/v1/imoveis_internos_fotos` +
    `?select=url,url_medium,principal,ordem` +
    `&imovel_id=eq.${encodeURIComponent(imovel.id)}` +
    `&order=principal.desc,ordem.asc`;

  let fotosRes: Response;
  try {
    fotosRes = await fetch(fotosUrl, {
      headers: supabaseHeaders(anonKey),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    return mapImovelRow(imovel);
  }

  if (!fotosRes.ok) return mapImovelRow(imovel);

  const fotos = (await fotosRes.json()) as VivanciFotoRow[];
  return {
    ...mapImovelRow(imovel),
    images: mapFotoRows(fotos),
  };
}
