import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(dir, "ConvitePage.tsx"), "utf8");

describe("ConvitePage", () => {
  it("shows a specific message for canceled courtesy invites", () => {
    expect(source).toContain("invitation_canceled");
    expect(source).toContain("Este convite foi cancelado");
    expect(source).not.toContain("invitation_already_used:");
  });

  it("prefills the login code when the invite link redirects with query params", () => {
    expect(source).toContain("useSearchParams");
    expect(source).toContain("sanitizeInviteCode");
    expect(source).toContain('searchParams.get("login_code")');
  });
});
