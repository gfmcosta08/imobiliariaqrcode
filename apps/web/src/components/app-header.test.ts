import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(dir, "app-header.tsx"), "utf8");

describe("AppHeader", () => {
  it("resolves admin visibility from the logged-in profile instead of relying on each page", () => {
    expect(source).toContain("createClient");
    expect(source).toContain("supabase.auth.getUser");
    expect(source).toContain('.from("profiles")');
    expect(source).toContain('.select("role")');
    expect(source).toContain('{ href: "/admin", label: "Admin" }');
  });
});
