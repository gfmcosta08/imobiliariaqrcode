import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Courtesy admin editing", () => {
  it("exposes an authenticated PATCH backed by the atomic RPC", () => {
    const route = read("src/app/api/admin/invitations/route.ts");

    expect(route).toContain("export async function PATCH");
    expect(route).toContain('supabase.rpc("admin_update_courtesy"');
    expect(route).toContain("p_admin_profile_id: admin.userId");
    expect(route).toContain("property_count");
    expect(route).toContain("expires_at");
  });

  it("offers courtesy editing controls after invitation generation", () => {
    const list = read("src/app/admin/pending-invitations-list.tsx");

    expect(list).toContain('data-testid="admin-invitation-edit"');
    expect(list).toContain('data-testid="admin-invitation-property-count"');
    expect(list).toContain('data-testid="admin-invitation-expires-at"');
  });
});
