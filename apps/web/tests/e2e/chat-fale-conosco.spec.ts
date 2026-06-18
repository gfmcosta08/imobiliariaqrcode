import { expect, test } from "@playwright/test";

const SESSION_ID = "550e8400-e29b-41d4-a716-446655440000";

test.describe("chat Fale Conosco", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((sessionId) => {
      localStorage.setItem("fale_conosco_session_id", sessionId);
      sessionStorage.removeItem("fale_conosco_accepted");
    }, SESSION_ID);
  });

  test("/contato carrega e botao abre modal com LGPD", async ({ page }) => {
    await page.route("**/api/chat/messages**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ messages: [] }),
      });
    });

    await page.goto("/contato");
    await expect(page.getByRole("heading", { name: "Fale Conosco" })).toBeVisible();
    await page.getByTestId("chat-inline-button").click();
    await expect(page.getByTestId("chat-modal")).toBeVisible();
    await expect(page.getByTestId("chat-lgpd-banner")).toBeVisible();
    await page.getByTestId("chat-lgpd-accept").click();
    await expect(page.getByTestId("chat-lgpd-banner")).not.toBeVisible();
  });

  test("envio chama POST /api/chat e polling chama GET /api/chat/messages", async ({ page }) => {
    let postCalled = false;
    let getCalled = false;

    await page.route("**/api/chat/messages**", async (route) => {
      getCalled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ messages: [] }),
      });
    });

    await page.route("**/api/chat", async (route) => {
      if (route.request().method() === "POST") {
        postCalled = true;
        const body = route.request().postDataJSON() as Record<string, string>;
        expect(body.session_id).toBe(SESSION_ID);
        expect(body.content).toContain("mensagem e2e");
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            id: "880e8400-e29b-41d4-a716-446655440003",
            kind_detected: "duvida",
          }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto("/contato");
    await page.getByTestId("chat-inline-button").click();
    await page.getByTestId("chat-lgpd-accept").click();
    await page.getByTestId("chat-visitor-name").fill("Visitante E2E");
    await page.getByTestId("chat-visitor-email").fill("e2e@example.com");
    await page.getByTestId("chat-input").fill("mensagem e2e de teste");
    await page.getByTestId("chat-send").click();

    await expect.poll(() => postCalled).toBe(true);
    await expect.poll(() => getCalled, { timeout: 10_000 }).toBe(true);
  });

  test("deslogado nao ve floating na home", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("chat-floating-bubble")).toHaveCount(0);
  });
});
