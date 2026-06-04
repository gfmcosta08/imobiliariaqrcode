import { describe, expect, it } from "vitest";

import { countUnansweredLeads, estimateCommissionBRL, formatResponseTime } from "./metrics";

describe("dashboard metrics helpers", () => {
  it("commission estimate ignores missing prices", () => {
    expect(estimateCommissionBRL([{ sale_price: null }, { sale_price: 0 }], [])).toBe(0);
    expect(estimateCommissionBRL([{ sale_price: 1_000_000 }], [])).toBe(60_000);
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
