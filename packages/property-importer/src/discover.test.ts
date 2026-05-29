import { describe, expect, it, vi } from "vitest";

import { discoverPropertyUrls, parsePropertyLinksFromHtml } from "./discover";

describe("parsePropertyLinksFromHtml", () => {
  it("extrai links /imovel/ID de HTML renderizado (SPA Vivanci)", () => {
    const base = new URL("https://vivanci.com/imoveis?tipo=comprar");
    const html = `
      <html><body>
        <a href="/imovel/0808">605 Sul</a>
        <a href="/imovel/0534">205 Sul</a>
        <a href="/imoveis?tipo=comprar">Ver todos</a>
      </body></html>
    `;
    const urls = parsePropertyLinksFromHtml(base, html, 10);
    expect(urls).toEqual([
      "https://vivanci.com/imovel/0808",
      "https://vivanci.com/imovel/0534",
    ]);
  });

  it("extrai detalhes-imovel.php (Logos)", () => {
    const base = new URL("https://www.logos-to.com.br/");
    const html = `
      <a href="detalhes-imovel.php?imovel=1746&finalidade=1">A</a>
      <a href="/imoveis">Listagem</a>
    `;
    const urls = parsePropertyLinksFromHtml(base, html, 10);
    expect(urls).toEqual([
      "https://www.logos-to.com.br/detalhes-imovel.php?imovel=1746&finalidade=1",
    ]);
  });
});

describe("discoverPropertyUrls SPA fallback", () => {
  it("usa extrator quando fetch estático não encontra imóveis", async () => {
    const renderedHtml = `<a href="/imovel/0808">A</a><a href="/imovel/0534">B</a>`;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo) => {
        const url = String(input);
        if (url.includes("/v1/discover")) {
          return new Response(
            JSON.stringify({ ok: true, url: "https://vivanci.com/", html: renderedHtml }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        throw new Error(`unexpected fetch: ${url}`);
      }),
    );

    const result = await discoverPropertyUrls("https://vivanci.com/", {
      fetchHtml: async () => "<html><body><div id=root></div></body></html>",
      extratorBaseUrl: "https://extrator.test",
    });

    vi.unstubAllGlobals();

    expect(result.mode).toBe("homepage");
    expect(result.urls).toHaveLength(2);
    expect(result.urls[0]).toContain("/imovel/0808");
  });

  it("tenta /imoveis quando homepage SPA não tem links de anúncio", async () => {
    const emptyHome = "<html><body><div id=root></div></body></html>";
    const listingHtml = `<a href="/imovel/0808">A</a>`;
    let discoverCalls = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo) => {
        const url = String(input);
        if (!url.includes("/v1/discover")) throw new Error(`unexpected fetch: ${url}`);
        discoverCalls += 1;
        const html = discoverCalls === 1 ? emptyHome : listingHtml;
        return new Response(JSON.stringify({ ok: true, url, html }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
    );

    const result = await discoverPropertyUrls("https://vivanci.com/", {
      fetchHtml: async () => emptyHome,
      extratorBaseUrl: "https://extrator.test",
    });

    vi.unstubAllGlobals();

    expect(result.urls).toHaveLength(1);
    expect(result.urls[0]).toContain("/imovel/0808");
    expect(discoverCalls).toBeGreaterThan(1);
  });
});
