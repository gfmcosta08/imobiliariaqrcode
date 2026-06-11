import { expect, test, type Page } from "@playwright/test";

const baseURL = process.env.STAGING_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? "";
const writeEnabled = process.env.E2E_STAGING_WRITE === "1";
const runId = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
const brokerEmail = `selfservice.qa.${runId}@teste.com`;
const brokerPassword = `TesteQA123!${runId.slice(-4)}`;
const brokerWhatsapp = `119${runId.slice(-8)}`;
const propertyTitle = `QA Self Service ${runId}`;

function requireWritableStaging() {
  test.skip(!baseURL, "Defina STAGING_BASE_URL para rodar E2E no staging.");
  test.skip(!writeEnabled, "Defina E2E_STAGING_WRITE=1 para permitir criacao de dados de QA.");
  test.skip(/production|prod|imoveisqr\.com/i.test(baseURL), "Base URL parece producao.");
  expect(baseURL).toContain("farollimoveis-staging");
}

async function signupBroker(page: Page) {
  await page.goto("/login?mode=signup&next=/onboarding/primeiro-qr");
  await page.getByTestId("signup-full-name").fill("Corretor QA Self Service");
  await page.getByTestId("signup-whatsapp").fill(brokerWhatsapp);
  await page.getByTestId("login-identifier").fill(brokerEmail);
  await page.getByTestId("login-password").fill(brokerPassword);
  await page.locator("#signup-terms").check();
  await page.getByTestId("login-submit").click();
  await page.waitForURL(/\/onboarding\/primeiro-qr/, { timeout: 60_000 });
}

async function createFirstQr(page: Page) {
  await page.locator('input[name="title"]').fill(propertyTitle);
  await page.locator('select[name="property_type"]').selectOption("Residencial");
  await page.locator('input[name="city"]').fill("Salvador");
  await page.locator('input[name="neighborhood"]').fill("Pituba");
  await page.locator('input[name="sale_price"]').fill("520000");
  const whatsappInput = page.locator('input[name="whatsapp_number"]');
  if ((await whatsappInput.count()) > 0) {
    await whatsappInput.fill(brokerWhatsapp);
  }
  await page.locator('textarea[name="description"]').fill("Fluxo completo de QA no staging.");
  await page.getByRole("button", { name: "Criar meu primeiro QR" }).click();
  await page.waitForURL(/\/properties\/[0-9a-f-]+/, { timeout: 60_000 });
  await expect(page.getByTestId("property-detail-title")).toContainText(propertyTitle);
  await expect(page.getByTestId("qr-print-area")).toBeVisible({ timeout: 30_000 });
  const qrUrl = (await page.getByTestId("qr-print-public-url").innerText()).trim();
  expect(qrUrl).toContain("/q/");
  return qrUrl;
}

async function openPublicQr(page: Page, qrUrl: string) {
  await page.goto(qrUrl);
  await expect(page.getByRole("heading", { name: propertyTitle })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("public-qr-whatsapp-link")).toBeVisible({ timeout: 30_000 });
  const whatsappHref = await page.getByTestId("public-qr-whatsapp-link").getAttribute("href");
  expect(whatsappHref ?? "").toContain("wa.me");
}

test("signup, primeiro QR, leitura publica e painel funcionam no staging", async ({
  page,
  context,
}) => {
  requireWritableStaging();

  await signupBroker(page);
  const qrUrl = await createFirstQr(page);

  const publicPage = await context.newPage();
  await openPublicQr(publicPage, qrUrl);
  await publicPage.close();

  await page.goto("/leads");
  await expect(page.getByText("Nenhum lead ainda.")).toBeVisible({ timeout: 45_000 });

  await page.goto("/dashboard");
  await expect(page.getByTestId("dashboard-metric-leads-total")).toContainText("0", {
    timeout: 30_000,
  });
  await expect(page.getByTestId("dashboard-metric-leads-unanswered")).toContainText("0");
  await expect(page.getByTestId("dashboard-metric-qr-scans")).toContainText("1");
});
