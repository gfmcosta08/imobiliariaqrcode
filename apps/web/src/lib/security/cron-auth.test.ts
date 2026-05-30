import { describe, expect, test, vi } from "vitest";

import { requireCronAuth } from "./cron-auth";

function req(url = "http://localhost/api/cron/test", headers?: Record<string, string>) {
  return new Request(url, { method: "GET", headers });
}

describe("requireCronAuth", () => {
  test("VULN-1: deve negar quando CRON_SECRET não está configurado (fail-secure)", () => {
    vi.stubEnv("CRON_SECRET", "");
    const r = requireCronAuth(req());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(500);
  });

  test("VULN-2: deve negar quando Authorization está incorreto", () => {
    vi.stubEnv("CRON_SECRET", "s3cr3t");
    const r = requireCronAuth(req("http://localhost/api/cron/test", { authorization: "Bearer nope" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(401);
  });

  test("deve aceitar quando Authorization está correto", () => {
    vi.stubEnv("CRON_SECRET", "s3cr3t");
    const r = requireCronAuth(req("http://localhost/api/cron/test", { authorization: "Bearer s3cr3t" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.cronSecret).toBe("s3cr3t");
  });

  test("deve aceitar `?secret=` quando allowQuerySecret=true", () => {
    vi.stubEnv("CRON_SECRET", "s3cr3t");
    const r = requireCronAuth(req("http://localhost/api/cron/test?secret=s3cr3t"), {
      allowQuerySecret: true,
    });
    expect(r.ok).toBe(true);
  });
});

