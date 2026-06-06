import { expect, test, type Page } from "@playwright/test";

test.setTimeout(180_000);

const baseURL = process.env.STAGING_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? "";
const writeEnabled = process.env.E2E_STAGING_WRITE === "1";
const stripeEnabled = process.env.E2E_STRIPE_CHECKOUT === "1";
const runId = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
const brokerEmail = `stripe.selfservice.qa.${runId}@teste.com`;
const brokerPassword = `TesteQA123!${runId.slice(-4)}`;
const brokerWhatsapp = `119${runId.slice(-8)}`;

function requireStripeStaging() {
  test.skip(!baseURL, "Defina STAGING_BASE_URL para rodar E2E no staging.");
  test.skip(!writeEnabled, "Defina E2E_STAGING_WRITE=1 para permitir criacao de dados de QA.");
  test.skip(!stripeEnabled, "Defina E2E_STRIPE_CHECKOUT=1 para checkout Stripe real.");
  test.skip(/production|prod|imoveisqr\.com/i.test(baseURL), "Base URL parece producao.");
  expect(baseURL).toContain("farollimoveis-staging");
}

async function signupBroker(page: Page) {
  const signup = await page.request.post("/api/auth/signup", {
    data: {
      email: brokerEmail,
      password: brokerPassword,
      fullName: "Corretor QA Stripe",
      whatsapp: brokerWhatsapp,
      acceptedLegal: true,
    },
  });
  expect(signup.status()).toBeLessThan(500);

  await page.goto("/login");
  await page.getByTestId("login-identifier").fill(brokerEmail);
  await page.getByTestId("login-password").fill(brokerPassword);
  await page.getByTestId("login-submit").click();
  await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
  await page.goto("/plans");
}

async function startStarterCheckout(page: Page) {
  await page.goto("/plans");
  const starterCard = page.locator("div").filter({
    has: page.getByRole("heading", { name: /^Starter$/i }),
  });
  const starterButton = starterCard
    .locator("button:not([disabled])")
    .filter({ hasText: /Starter|Assinar|Contratar|pagamento/i })
    .first();
  await expect(starterButton).toBeVisible({ timeout: 30_000 });
  await starterButton.click();
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 60_000 });
  const checkoutUrl = page.url();
  const sessionId = checkoutUrl.match(/cs_test_[^/?#]+/)?.[0] ?? "";
  expect(sessionId).toMatch(/^cs_test_/);
  console.log(`STRIPE_CHECKOUT_SESSION_ID=${sessionId}`);
}

async function fillTextbox(page: Page, name: RegExp, value: string) {
  const field = page.getByRole("textbox", { name }).first();
  await expect(field).toBeVisible({ timeout: 60_000 });
  await field.fill(value);
}

async function completeStripePayment(page: Page) {
  await fillTextbox(page, /Card number/i, "4242424242424242");
  await fillTextbox(page, /Expiration/i, "1234");
  await fillTextbox(page, /^CVC$/i, "123");
  await fillTextbox(page, /Cardholder name/i, "Corretor QA Stripe");

  const payButton = page.getByRole("button", {
    name: /Pagar|Pay|Assinar|Subscribe|Confirmar/i,
  });
  await expect(payButton).toBeVisible({ timeout: 60_000 });
  await payButton.click();
  await page.waitForURL(/\/dashboard\?checkout=success|\/dashboard/, { timeout: 150_000 });
  await expect(page.getByText(/Starter|starter_active|Plano/i).first()).toBeVisible({
    timeout: 45_000,
  });
}

test("checkout Starter sandbox completa e retorna ao dashboard", async ({ page }) => {
  requireStripeStaging();

  await signupBroker(page);
  await startStarterCheckout(page);
  await completeStripePayment(page);
});
