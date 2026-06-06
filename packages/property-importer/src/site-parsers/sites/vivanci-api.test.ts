import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  extractVivanciCodigoFromUrl,
  fetchVivanciListingFromApi,
  fetchVivanciSupabaseAnonKey,
  resetVivanciApiCacheForTests,
} from "./vivanci-api";

const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5cWF3Y2Vxb3dqbXpndWpycHR4In0.test";

type FetchRoute = {
  match: (url: string) => boolean;
  response: () => Response;
};

function mockFetch(routes: FetchRoute[]) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    for (const route of routes) {
      if (route.match(url)) return route.response();
    }
    return new Response("not found", { status: 404 });
  });
}

const bundleRoutes: FetchRoute[] = [
  {
    match: (url) => url.endsWith("/assets/client-xyz789.js"),
    response: () => new Response(`const k="${ANON_KEY}"`, { status: 200 }),
  },
  {
    match: (url) => url.endsWith("/assets/index-abc123.js"),
    response: () => new Response('"assets/client-xyz789.js"', { status: 200 }),
  },
  {
    match: (url) => url === "https://vivanci.com/" || url === "https://vivanci.com",
    response: () =>
      new Response(
        '<link rel="modulepreload" href="/assets/client-xyz789.js"><script src="/assets/index-abc123.js"></script>',
        { status: 200 },
      ),
  },
];

describe("extractVivanciCodigoFromUrl", () => {
  it("extrai codigo numerico do path /imovel/0826", () => {
    expect(extractVivanciCodigoFromUrl("https://vivanci.com/imovel/0826")).toBe("0826");
    expect(extractVivanciCodigoFromUrl("https://vivanci.com/imovel/0826/")).toBe("0826");
  });

  it("retorna null para URL invalida", () => {
    expect(extractVivanciCodigoFromUrl("https://vivanci.com/imoveis")).toBeNull();
  });
});

describe("fetchVivanciSupabaseAnonKey", () => {
  beforeEach(() => {
    resetVivanciApiCacheForTests();
    vi.stubGlobal("fetch", mockFetch(bundleRoutes));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetVivanciApiCacheForTests();
  });

  it("busca anon key na cadeia index -> client", async () => {
    const key = await fetchVivanciSupabaseAnonKey();
    expect(key).toBe(ANON_KEY);
  });
});

describe("fetchVivanciListingFromApi", () => {
  const imovelId = "501cfa26-43d4-492d-9d6e-36bdca0db324";
  const longDescription = "A".repeat(1149);

  beforeEach(() => {
    resetVivanciApiCacheForTests();
    vi.stubGlobal(
      "fetch",
      mockFetch([
        {
          match: (url) => url.includes("imoveis_internos_fotos"),
          response: () =>
            new Response(
              JSON.stringify(
                Array.from({ length: 15 }, (_, i) => ({
                  url: `https://tyqawceqowjmzgujrptx.supabase.co/storage/v1/object/public/imoveis-fotos/${imovelId}/foto-${i}.jpeg`,
                  principal: i === 0,
                  ordem: i,
                })),
              ),
              { status: 200, headers: { "content-type": "application/json" } },
            ),
        },
        {
          match: (url) => url.includes("imoveis_internos?"),
          response: () =>
            new Response(
              JSON.stringify([
                {
                  id: imovelId,
                  codigo: "0826",
                  titulo: "Apartamento teste",
                  descricao: longDescription,
                  end_cidade: "Curitiba",
                  end_estado: "PR",
                  qtd_quartos: 3,
                  valor_venda: 850000,
                },
              ]),
              { status: 200, headers: { "content-type": "application/json" } },
            ),
        },
        ...bundleRoutes,
      ]),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetVivanciApiCacheForTests();
  });

  it("retorna descricao completa e 15 fotos do imovel 0826", async () => {
    const listing = await fetchVivanciListingFromApi("https://vivanci.com/imovel/0826");
    expect(listing).not.toBeNull();
    expect(listing!.full_description).toHaveLength(1149);
    expect(listing!.images).toHaveLength(15);
    expect(listing!.images![0]!.url).toContain(imovelId);
    expect(listing!.internal_code).toBe("0826");
    expect(listing!.title).toBe("Apartamento teste");
  });

  it("aceita fotos no CDN Arbo (nao Supabase)", async () => {
    const arboUrl =
      "https://static.arboimoveis.com.br/AP0331_VVC/whatsapp-image-2026-03-11-at-16-00-391773255661071.jpeg";
    vi.stubGlobal(
      "fetch",
      mockFetch([
        {
          match: (url) => url.includes("imoveis_internos_fotos"),
          response: () =>
            new Response(JSON.stringify([{ url: arboUrl, principal: true, ordem: 0 }]), {
              status: 200,
              headers: { "content-type": "application/json" },
            }),
        },
        {
          match: (url) => url.includes("imoveis_internos?"),
          response: () =>
            new Response(
              JSON.stringify([
                {
                  id: "bd58416e-b20f-4a17-8428-3675a64fac2a",
                  codigo: "0694",
                  titulo: "Duplex Arbo",
                  descricao: "desc",
                },
              ]),
              { status: 200, headers: { "content-type": "application/json" } },
            ),
        },
        ...bundleRoutes,
      ]),
    );

    const listing = await fetchVivanciListingFromApi("https://vivanci.com/imovel/0694");
    expect(listing?.images).toHaveLength(1);
    expect(listing?.images?.[0]?.url).toBe(arboUrl);
  });
});
