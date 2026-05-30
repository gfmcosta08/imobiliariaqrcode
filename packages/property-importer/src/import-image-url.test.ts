import { describe, expect, it } from "vitest";

import {
  isAllowedImportImageUrl,
  isDecorativeImportImageUrl,
  isPropertyImportImageUrl,
  normalizeImportImageUrl,
  rankPropertyImportImageUrls,
} from "./import-image-url";

describe("isAllowedImportImageUrl", () => {
  it("aceita CDN Imoview usado pela Casa63", () => {
    expect(
      isAllowedImportImageUrl(
        "https://cdn.imoview.com.br/casa63/Imoveis/14015/foto1.jpg?1768247280",
        "www.casa63.com.br",
      ),
    ).toBe(true);
  });

  it("aceita CDN Kenlo usado pelo site piloto", () => {
    expect(
      isAllowedImportImageUrl(
        "https://imgs.kenlo.io/VWRCUkQ2Tnp3d1BJRDBJVe1szkhnWr9UfpZS9ftWwjXgr7v5Znen3XVcMHllDVRJJeIbi3YwVYEtu0c++u1R9xwCttsAX++9tRSgz6WVu9vFl2+r9pGLkbLC+f2iZ5r39Ich-aCuImeL67E4ad0OCnlgbNJjYFnlQYuKE3VNjzKgmGHxFKBFe3sF5iEIqyd2lVyrdp2g5Xkd2yieU9OCoXeyXavaUEN1QPlLANk18QdW9hinR0InpwcS45urs3PTcKG1MI36iGwAF0wy6oK5APevm5PPedV-GacxP3wP61NeW6wcmvuVAupw6QEZovrFTQeShQjQiOM3eYWsWdZKnrwHl16WHbJM603ql9fB1vCqPR6GZlFv8uycqfq5aaqnS7SNW0+DxctT35DXLcNXLIu0BGcAACZELzwb6gKx6KuM8hq6J2jDukILHRPRztwnpXZ9YEZW-81OuG+4gci8Nw==.jpg",
      ),
    ).toBe(true);
  });

  it("aceita fotos Supabase do Vivanci", () => {
    expect(
      isAllowedImportImageUrl(
        "https://tyqawceqowjmzgujrptx.supabase.co/storage/v1/object/public/imoveis-fotos/a5755d73-c356-407f-a2e6-c421e2806754/1778767564833-foto.jpeg",
        "vivanci.com",
      ),
    ).toBe(true);
  });

  it("aceita fotos Supabase do Vivanci com nome WhatsApp_Image no arquivo", () => {
    const url =
      "https://tyqawceqowjmzgujrptx.supabase.co/storage/v1/object/public/imoveis-fotos/a5755d73-c356-407f-a2e6-c421e2806754/1778767564833-WhatsApp_Image_2026-05-14_at_10.48.27.jpeg";
    expect(isPropertyImportImageUrl(url, "vivanci.com")).toBe(true);
  });

  it("aceita CDN Arbo usado pelo Vivanci (imovel 0694)", () => {
    const url =
      "https://static.arboimoveis.com.br/AP0331_VVC/whatsapp-image-2026-03-11-at-16-00-391773255661071.jpeg";
    expect(isPropertyImportImageUrl(url, "vivanci.com")).toBe(true);
  });

  it("rejeita logo e ícones do site de origem", () => {
    expect(
      isPropertyImportImageUrl(
        "https://www.casa63.com.br/assets/img/e0sf8ty.png?v=1666201536",
        "www.casa63.com.br",
      ),
    ).toBe(false);
    expect(
      isPropertyImportImageUrl(
        "https://www.casa63.com.br/assets/icons/icon-favorito-cinza.svg",
        "www.casa63.com.br",
      ),
    ).toBe(false);
  });
});

describe("rankPropertyImportImageUrls", () => {
  it("prioriza fotos do imóvel sobre assets do site", () => {
    const ranked = rankPropertyImportImageUrls(
      [
        "https://www.casa63.com.br/assets/img/e0sf8ty.png",
        "https://cdn.imoview.com.br/casa63/Imoveis/14015/foto1.jpg",
        "https://cdn.imoview.com.br/casa63/Imoveis/14015/foto2.jpg",
      ],
      "www.casa63.com.br",
    );
    expect(ranked[0]).toContain("imoview.com.br");
    expect(ranked.every((u) => !u.includes("/assets/img/"))).toBe(true);
  });

  it("desembrulha proxy Next.js para URL Supabase do Vivanci", () => {
    const direct =
      "https://tyqawceqowjmzgujrptx.supabase.co/storage/v1/object/public/imoveis-fotos/abc/foto.jpeg";
    const proxy = `https://vivanci.com/_next/image?url=${encodeURIComponent(direct)}&w=1080&q=75`;
    expect(normalizeImportImageUrl(proxy)).toBe(direct);
    expect(isDecorativeImportImageUrl(proxy)).toBe(true);
    const ranked = rankPropertyImportImageUrls([proxy], "vivanci.com");
    expect(ranked).toEqual([direct]);
  });
});

describe("isDecorativeImportImageUrl", () => {
  it("ignora logos SVG do Kenlo", () => {
    expect(isDecorativeImportImageUrl("https://static-sites.kenlo.io/2.1.3/img/kenlo.svg")).toBe(
      true,
    );
  });
});
