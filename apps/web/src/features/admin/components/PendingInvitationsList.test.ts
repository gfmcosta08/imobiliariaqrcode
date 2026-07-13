import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(dir, "PendingInvitationsList.tsx"), "utf8");

describe("PendingInvitationsList", () => {
  it("lets admins edit pending invitation limits and expiration", () => {
    expect(source).toContain('data-testid="admin-invitation-edit"');
    expect(source).toContain('data-testid="admin-invitation-property-count"');
    expect(source).toContain('data-testid="admin-invitation-expires-at"');
    expect(source).toContain('method: "PATCH"');
  });
});
