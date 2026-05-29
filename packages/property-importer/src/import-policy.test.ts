import { afterEach, describe, expect, it } from "vitest";

import { getImportUrlPolicy } from "./import-policy";

describe("getImportUrlPolicy", () => {
  const prevMode = process.env.PROPERTY_IMPORT_MODE;
  const prevHosts = process.env.PROPERTY_IMPORT_ALLOWED_HOSTS;

  afterEach(() => {
    if (prevMode === undefined) delete process.env.PROPERTY_IMPORT_MODE;
    else process.env.PROPERTY_IMPORT_MODE = prevMode;
    if (prevHosts === undefined) delete process.env.PROPERTY_IMPORT_ALLOWED_HOSTS;
    else process.env.PROPERTY_IMPORT_ALLOWED_HOSTS = prevHosts;
  });

  it("default é open", () => {
    delete process.env.PROPERTY_IMPORT_MODE;
    expect(getImportUrlPolicy().mode).toBe("open");
  });

  it("modo allowlist parseia hosts", () => {
    process.env.PROPERTY_IMPORT_MODE = "allowlist";
    process.env.PROPERTY_IMPORT_ALLOWED_HOSTS = "casa63.com.br, loft.com.br";
    expect(getImportUrlPolicy()).toEqual({
      mode: "allowlist",
      allowedHosts: ["casa63.com.br", "loft.com.br"],
    });
  });
});
