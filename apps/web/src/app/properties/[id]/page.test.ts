import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(dir, "page.tsx"), "utf8");

describe("property detail QR actions", () => {
  it("does not require real WhatsApp bot testing from staging", () => {
    expect(source).not.toContain("property-qr-whatsapp-test");
    expect(source).not.toContain("Testar WhatsApp");
    expect(source).toContain("Abrir pagina do QR");
  });
});
