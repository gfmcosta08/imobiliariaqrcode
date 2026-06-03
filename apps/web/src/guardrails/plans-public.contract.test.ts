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

  it("does not hard-disable Stripe billing in production code paths", () => {
    const plansPage = read("src/app/plans/page.tsx");
    const checkoutRoute = read("src/app/api/stripe/create-checkout/route.ts");
    const portalRoute = read("src/app/api/stripe/customer-portal/route.ts");
    const webhookRoute = read("src/app/api/webhooks/stripe/route.ts");
    const stripeLib = read("src/lib/stripe.ts");

    expect(plansPage).not.toContain('if (process.env.VERCEL_ENV === "production") return false;');
    expect(checkoutRoute).not.toContain("checkout_not_enabled_in_production");
    expect(portalRoute).not.toContain("portal_not_enabled_in_production");
    expect(webhookRoute).not.toContain("webhook_disabled_in_production");
    expect(stripeLib).not.toContain("STRIPE_PRICE_SOLO");
  });

  it("keeps Starter statuses available in admin subscription tooling", () => {
    const manager = read("src/app/admin/subscriptions-manager.tsx");
    const route = read("src/app/api/admin/subscriptions/[accountId]/route.ts");

    expect(manager).toContain('"starter_active"');
    expect(manager).toContain('"starter"');
    expect(route).toContain('"starter_active"');
    expect(route).toContain('"starter"');
  });
});
