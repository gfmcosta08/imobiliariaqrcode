import { afterEach, describe, expect, it, vi } from "vitest";

import {
  extractListingsFromUrls,
  fetchRenderedHtmlFromExtrator,
  normalizeExtratorFetchError,
  probeExtratorConnectivity,
} from "./extrator-client";

const EXTRACTOR = "https://extrator.test";
const LISTING_URL = "https://imobiliariasonhar.com.br/imovel/apartamento/AP0029-SOOR";

describe("normalizeExtratorFetchError", () => {
  it("mapeia fetch failed para extrator_unreachable", () => {
    expect(normalizeExtratorFetchError(new Error("fetch failed"))).toBe("extrator_unreachable");
  });

  it("mapeia AbortError para extrator_timeout", () => {
    const err = new Error("The operation was aborted");
    err.name = "AbortError";
    expect(normalizeExtratorFetchError(err)).toBe("extrator_timeout");
  });

  it("preserva extrator_http_*", () => {
    expect(normalizeExtratorFetchError(new Error("extrator_http_502:bad gateway"))).toBe(
      "extrator_http_502:bad gateway",
    );
  });
});

describe("fetchRenderedHtmlFromExtrator", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retorna null quando fetch falha em rede", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("fetch failed")),
    );

    const html = await fetchRenderedHtmlFromExtrator(EXTRACTOR, LISTING_URL);
    expect(html).toBeNull();
  });
});

describe("extractListingsFromUrls", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lança extrator_unreachable quando fetch falha em rede", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("fetch failed")),
    );

    await expect(
      extractListingsFromUrls([LISTING_URL], { extratorBaseUrl: EXTRACTOR }),
    ).rejects.toThrow("extrator_unreachable");
  });
});

describe("probeExtratorConnectivity", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retorna ok quando /health responde", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("ok", { status: 200 })),
    );

    const result = await probeExtratorConnectivity(EXTRACTOR);
    expect(result.extrator).toBe("ok");
    if (result.extrator === "ok") {
      expect(result.httpStatus).toBe(200);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    }
  });

  it("retorna unreachable quando fetch falha", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("fetch failed")),
    );

    const result = await probeExtratorConnectivity(EXTRACTOR);
    expect(result).toEqual({
      extrator: "unreachable",
      detail: "fetch failed",
      latencyMs: expect.any(Number),
    });
  });
});
