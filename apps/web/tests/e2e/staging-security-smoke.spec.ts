import { expect, test } from "@playwright/test";

const baseURL = process.env.STAGING_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? "";

test.describe("seguranca funcional staging", () => {
  test.beforeEach(() => {
    test.skip(!baseURL, "Defina STAGING_BASE_URL.");
    test.skip(/production|prod/i.test(baseURL), "Base URL parece producao.");
  });

  test("rotas protegidas redirecionam visitante para login", async ({ page }) => {
    for (const path of ["/dashboard", "/properties", "/admin", "/leads", "/profile"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
    }
  });

  test("API import retorna 401 sem sessao", async ({ request }) => {
    const res = await request.post("/api/properties/import", {
      data: { url: "https://imobiliariasonhar.com.br/imovel/test/AP0000-TEST" },
    });
    expect(res.status()).toBe(401);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("unauthorized");
  });

  test("API health publica sem stacktrace sensivel", async ({ request }) => {
    const res = await request.get("/api/health?deep=1");
    expect(res.ok()).toBeTruthy();
    const text = await res.text();
    expect(text.toLowerCase()).not.toContain("stack");
    expect(text.toLowerCase()).not.toContain("password");
  });

  test("paginas publicas smoke sem login", async ({ page }) => {
    for (const path of ["/", "/login", "/plans", "/convite"]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBeLessThan(500);
    }
  });
});
