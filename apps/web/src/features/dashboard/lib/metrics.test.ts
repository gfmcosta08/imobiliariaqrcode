import { describe, expect, it } from "vitest";

import { buildDashboardMoneyMetrics, countUnansweredLeads, formatResponseTime } from "./metrics";

describe("dashboard metrics helpers", () => {
  it("does not expose commission estimates before commercial validation", () => {
    const metrics = buildDashboardMoneyMetrics({
      properties: [{ id: "p1", title: "Apto", listing_status: "published", sale_price: 1_000_000 }],
      leads: [{ status: "new", property_id: "p1", created_at: "2026-06-04T12:00:00Z" }],
      qrScans: 1,
    });

    expect(metrics).not.toHaveProperty("estimatedCommissionBRL");
  });

  it("unanswered leads count statuses new and contact_pending", () => {
    expect(
      countUnansweredLeads([
        { status: "new" },
        { status: "contact_pending" },
        { status: "responded" },
      ]),
    ).toBe(2);
  });

  it("response time renders null as Sem dados", () => {
    expect(formatResponseTime(null)).toBe("Sem dados");
  });
});
