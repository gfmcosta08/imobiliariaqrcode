import { afterEach, describe, expect, it, vi } from "vitest";

import { isPropertyImportEnabled } from "./enabled";

describe("isPropertyImportEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("desliga em produção", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect(isPropertyImportEnabled()).toBe(false);
  });

  it("liga em preview por padrão", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("NODE_ENV", "production");
    expect(isPropertyImportEnabled()).toBe(true);
  });

  it("respeita ENABLE_PROPERTY_IMPORT=0", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("ENABLE_PROPERTY_IMPORT", "0");
    expect(isPropertyImportEnabled()).toBe(false);
  });
});
