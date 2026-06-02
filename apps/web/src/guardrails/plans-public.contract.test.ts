import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Public plans", () => {
  it("publishes Free and Starter with recurring price and legal links", () => {
    const page = read("src/app/plans/page.tsx");
    expect(page).toContain('plan_code: "free"');
    expect(page).toContain('plan_code: "starter"');
    expect(page).toContain('display_price: "R$ 150"');
    expect(page).toContain("LEGAL_ROUTES.refund_cancellation");
  });

  it("offers Customer Portal management on Starter dashboard", () => {
    const dashboard = read("src/app/dashboard/page.tsx");
    expect(dashboard).toContain("ManageSubscriptionButton");
    expect(dashboard).toContain("starter_active");
  });
});
