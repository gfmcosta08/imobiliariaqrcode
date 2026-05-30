import { describe, expect, test, vi } from "vitest";

// Mocks devem vir antes do import do handler.
vi.mock("@/lib/public/qr-token-active", () => ({
  assertQrTokenActive: vi.fn(async () => ({ ok: true, property_id: "p1", broker_id: "b1" })),
}));
vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: vi.fn(() => ({
    rpc: vi.fn(async () => ({ data: "lead1", error: null })),
  })),
}));

import { POST } from "./route";

describe("POST /api/public/lead security", () => {
  test("VULN-3: deve rejeitar payload acima do limite (413)", async () => {
    const big = "x".repeat(9000);
    const res = await POST(
      new Request("http://localhost/api/public/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ qr_token: big, client_phone: "5511999999999" }),
      }),
    );
    expect(res.status).toBe(413);
  });

  test("VULN-4: deve rejeitar campo inesperado (400)", async () => {
    const res = await POST(
      new Request("http://localhost/api/public/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          qr_token: "t",
          client_phone: "5511999999999",
          isAdmin: true,
        }),
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("unexpected_field");
  });
});

