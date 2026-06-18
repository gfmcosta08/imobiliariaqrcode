import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "../../../..");

function read(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

describe("Courtesy property limit guardrails", () => {
  it("account_property_limit respeita o override usado pelos convites", () => {
    const migration = read(
      path.join(
        repoRoot,
        "supabase/migrations/20260618120000_fix_courtesy_property_limit_override.sql",
      ),
    );

    expect(migration).toContain("create or replace function public.account_property_limit");
    expect(migration).toContain("create schema if not exists private");
    expect(migration).toContain("private.assert_rpc_account_scope");
    expect(migration).toContain("max_active_properties_override");
    expect(migration).toContain("property_limit_override");
    expect(migration).toContain(
      "coalesce(s.max_active_properties_override, s.property_limit_override)",
    );
  });
});
