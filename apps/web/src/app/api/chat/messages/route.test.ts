import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SAMPLE_UUID = "550e8400-e29b-41d4-a716-446655440000";
const USER_ID = "770e8400-e29b-41d4-a716-446655440002";

const mockGetUser = vi.fn();

function makeQueryChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  chain.eq = vi.fn(() => chain);
  chain.gte = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.then = (resolve: (value: typeof result) => void) => resolve(result);
  return chain;
}

let queryResult = { data: [] as unknown[], error: null as unknown };

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => makeQueryChain(queryResult)),
    })),
  })),
}));

describe("GET /api/chat/messages", () => {
  beforeEach(() => {
    vi.resetModules();
    queryResult = { data: [], error: null };
    mockGetUser.mockResolvedValue({ data: { user: null } });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function loadGet() {
    const { GET } = await import("./route");
    return GET;
  }

  it("anonimo exige session_id", async () => {
    const GET = await loadGet();
    const res = await GET(new Request("http://localhost/api/chat/messages"));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("session_id_required");
  });

  it("anonimo com session_id valido retorna mensagens", async () => {
    const GET = await loadGet();
    const res = await GET(
      new Request(`http://localhost/api/chat/messages?session_id=${SAMPLE_UUID}`),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { messages: unknown[] };
    expect(json.messages).toEqual([]);
  });

  it("autenticado nao exige session_id", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    const GET = await loadGet();
    const res = await GET(new Request("http://localhost/api/chat/messages"));
    expect(res.status).toBe(200);
  });

  it("aplica since valido", async () => {
    const GET = await loadGet();
    const since = "2026-06-18T10:00:00.000Z";
    const res = await GET(
      new Request(
        `http://localhost/api/chat/messages?session_id=${SAMPLE_UUID}&since=${encodeURIComponent(since)}`,
      ),
    );
    expect(res.status).toBe(200);
  });

  it("retorna 500 quando Supabase falha", async () => {
    queryResult = { data: null, error: { message: "fail" } };
    const GET = await loadGet();
    const res = await GET(
      new Request(`http://localhost/api/chat/messages?session_id=${SAMPLE_UUID}`),
    );
    expect(res.status).toBe(500);
  });
});
