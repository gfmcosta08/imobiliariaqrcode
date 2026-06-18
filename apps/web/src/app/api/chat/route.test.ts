import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SAMPLE_UUID = "550e8400-e29b-41d4-a716-446655440000";
const MESSAGE_ID = "660e8400-e29b-41d4-a716-446655440001";

const mockGetUser = vi.fn();
const mockInsert = vi.fn();
const mockSingle = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.resetModules();
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockSingle.mockResolvedValue({ data: { id: MESSAGE_ID }, error: null });
    mockInsert.mockReturnValue({ select: vi.fn().mockReturnValue({ single: mockSingle }) });
    mockFrom.mockReturnValue({ insert: mockInsert });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    delete process.env.CONTATO_BRIDGE_URL;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  async function loadPost() {
    const { POST } = await import("./route");
    return POST;
  }

  function makeRequest(body: unknown) {
    return new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("sucesso com persistencia", async () => {
    const POST = await loadPost();
    const res = await POST(
      makeRequest({ session_id: SAMPLE_UUID, content: "Ola, tenho uma duvida" }),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; id: string; kind_detected: string };
    expect(json.ok).toBe(true);
    expect(json.id).toBe(MESSAGE_ID);
    expect(json.kind_detected).toBe("duvida");
  });

  it("rejeita JSON invalido", async () => {
    const POST = await loadPost();
    const res = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: "not-json",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejeita UUID invalido", async () => {
    const POST = await loadPost();
    const res = await POST(makeRequest({ session_id: "bad", content: "oi" }));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("invalid_session_id");
  });

  it("rejeita conteudo vazio", async () => {
    const POST = await loadPost();
    const res = await POST(makeRequest({ session_id: SAMPLE_UUID, content: "   " }));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("empty_content");
  });

  it("retorna 500 quando Supabase falha", async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: "db error" } });
    const POST = await loadPost();
    const res = await POST(makeRequest({ session_id: SAMPLE_UUID, content: "oi" }));
    expect(res.status).toBe(500);
  });

  it("retorna 200 quando ponte VPS falha mas DB salvou", async () => {
    process.env.CONTATO_BRIDGE_URL = "http://bridge.test/api/contato";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const POST = await loadPost();
    const res = await POST(makeRequest({ session_id: SAMPLE_UUID, content: "oi" }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean };
    expect(json.ok).toBe(true);
  });
});
