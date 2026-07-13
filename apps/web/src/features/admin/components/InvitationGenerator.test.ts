import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(dir, "InvitationGenerator.tsx"), "utf8");
const cssSource = readFileSync(resolve(dir, "../../../app/globals.css"), "utf8");

describe("InvitationGenerator — impressao em pagina unica", () => {
  it("usa abordagem iframe para imprimir, nao window.print()", () => {
    expect(source).not.toContain("window.print()");
    expect(source).toContain('document.createElement("iframe")');
    expect(source).toContain("printWindow.print()");
  });

  it("cria iframe invisivel fixo com dimensoes zero", () => {
    expect(source).toContain('iframe.style.height = "0"');
    expect(source).toContain('iframe.style.width = "0"');
    expect(source).toContain('iframe.style.position = "fixed"');
  });

  it("define @page com A4 portrait e margin zero no iframe", () => {
    expect(source).toContain("@page");
    expect(source).toContain("size: A4 portrait");
    expect(source).toContain("margin: 0");
  });

  it("protege contra quebra de pagina no conteudo impresso", () => {
    expect(source).toContain("break-after: avoid");
    expect(source).toContain("break-before: avoid");
    expect(source).toContain("break-inside: avoid");
  });

  it("usar ref para a area de impressao em vez de id", () => {
    expect(source).toContain("printAreaRef");
    expect(source).toContain("useRef<HTMLDivElement>");
    expect(source).toContain("ref={printAreaRef}");
  });

  it("conteudo impresso contem logo, QR, credenciais e URL", () => {
    expect(source).toContain("qr-sign-logo-black-blue.png");
    expect(source).toContain("admin-invite-login-code-print");
    expect(source).toContain("admin-invite-access-code-print");
    expect(source).toContain("/convite");
  });

  it("usa public_id do primeiro imovel no titulo do PDF e na area impressa", () => {
    expect(source).toContain("public_id: string | null");
    expect(source).toContain("buildConvitePrintTitle");
    expect(source).toContain('data-testid="admin-invite-public-id-print"');
    expect(source).toContain("ID do imovel");
    expect(source).toContain("result.public_id");
  });

  it("ajusta document.title da pagina antes de imprimir para nomear o PDF", () => {
    expect(source).toContain("const previousTitle = document.title");
    expect(source).toContain("document.title = printTitle");
    expect(source).toContain("document.title = previousTitle");
    expect(source).toContain('addEventListener("afterprint", cleanup');
    expect(source).toContain("doc.title = printTitle");
  });

  it("nao usa titulo fixo generico no iframe de impressao", () => {
    expect(source).not.toContain("<title>Convite Cortesia - ImoveisQR</title>");
  });

  it("botoes de acao usam classe convite-screen-only (ocultos na impressao)", () => {
    expect(source).toContain("convite-screen-only");
  });

  it("area de impressao usa classe convite-print-area", () => {
    expect(source).toContain("convite-print-area");
  });

  it("dados-testid essenciais permanecem para teste de regressao", () => {
    expect(source).toContain('data-testid="admin-invite-generate"');
    expect(source).toContain('data-testid="admin-invite-result"');
    expect(source).toContain('data-testid="admin-invite-print"');
    expect(source).toContain('data-testid="admin-invite-login-code-print"');
    expect(source).toContain('data-testid="admin-invite-access-code-print"');
    expect(source).toContain('data-testid="admin-invite-property-count"');
    expect(source).toContain('data-testid="admin-invite-expiration-days"');
    expect(source).toContain('data-testid="admin-invite-print-area"');
    expect(source).toContain('data-testid="admin-invite-public-id-print"');
  });
});

describe("InvitationGenerator — regras CSS de impressao para convite", () => {
  it("possui regras @media print para convite-print-area", () => {
    expect(cssSource).toContain("printing-convite");
    expect(cssSource).toContain(".convite-print-area");
    expect(cssSource).toContain(".convite-screen-only");
  });

  it("oculta tudo exceto convite-print-area durante impressao", () => {
    expect(cssSource).toMatch(/body\.printing-convite \*\s*\{[^}]*display:\s*none\s*!important/);
    expect(cssSource).toMatch(
      /body\.printing-convite \.convite-print-area[^,]*\{[^}]*display:\s*revert\s*!important/,
    );
  });

  it("protege contra quebra de pagina no CSS global", () => {
    const conviteBlock = cssSource.match(/body\.printing-convite \.convite-print-area \{[^}]+\}/s);
    expect(conviteBlock).not.toBeNull();
    expect(conviteBlock![0]).toContain("break-inside: avoid");
    expect(conviteBlock![0]).toContain("page-break-inside: avoid");
  });

  it("regras QR plate preservadas sem regressao", () => {
    expect(cssSource).toContain("printing-qr-plate");
    expect(cssSource).toContain(".qr-print-area");
    expect(cssSource).toContain(".qr-screen-only");
  });
});
