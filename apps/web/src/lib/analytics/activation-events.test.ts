import { describe, expect, it } from "vitest";

import { ACTIVATION_EVENT_NAMES, isActivationEventName } from "./activation-events";

describe("activation events", () => {
  it("event names are typed", () => {
    expect(ACTIVATION_EVENT_NAMES).toContain("checkout_completed");
    expect(isActivationEventName("lead_received")).toBe(true);
  });

  it("rejects invalid empty event name", () => {
    expect(isActivationEventName("")).toBe(false);
    expect(isActivationEventName("invalid_event")).toBe(false);
  });
});
