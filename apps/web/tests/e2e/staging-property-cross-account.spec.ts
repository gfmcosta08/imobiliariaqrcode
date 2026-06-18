import { expect, test, type Page } from "@playwright/test";
import fs from "fs";
import path from "path";

const baseURL = process.env.STAGING_BASE_URL ?? "";
const writeEnabled = process.env.E2E_STAGING_WRITE === "1";
const runId = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
const evidenceDir = path.resolve(process.cwd(), "../../../qa-evidencias/rodada-pr9");

const userAEmail = `qa.owner.${runId}@teste.com`;
const userAPassword = `TesteQA123!${runId.slice(-4)}`;
const userBEmail = `qa.intruder.${runId}@teste.com`;
const userBPassword = `TesteQA123!${runId.slice(-4)}`;
const userAWhatsapp = `6299${runId.slice(-8)}`;
const userBWhatsapp = `6298${runId.slice(-8)}`;

function requireStaging() {
  test.skip(!baseURL, "STAGING_BASE_URL");
  test.skip(!writeEnabled, "E2E_STAGING_WRITE=1");
  test.skip(/production|prod|imoveisqr\.com/i.test(baseURL), "producao");
  expect(baseURL).toContain("farollimoveis-staging");
}

async function signupFree(page: Page, email: string, password: string, whatsapp: string, name: string) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Cadastre-se" }).click();
  await page.getByTestId("signup-full-name").fill(name);
  await page.getByTestId("signup-whatsapp").fill(whatsapp);
  await page.getByTestId("login-identifier").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.locator("#signup-terms").check();
  await page.getByTestId("login-submit").click();
  await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
}

async function createProperty(page: Page, title: string, code: string) {
  await page.goto("/properties/new");
  await page.getByTestId("property-internal_code").fill(code);
  await page.getByTestId("property-property_type").selectOption("Residencial");
  await page.getByTestId("property-property_subtype").selectOption("Apartamento");
  await page.getByTestId("property-purpose").selectOption("sale");
  await page.getByTestId("property-listing_status").selectOption("published");
  await page.getByTestId("property-title").fill(title);
  await page.getByTestId("property-full_description").fill(`Isolamento QA ${runId}`);
  await page.getByTestId("property-sale_price").fill("250000");
  await page.getByTestId("property-total_area_m2").fill("70");
  await page.getByTestId("property-bedrooms").fill("2");
  await page.getByTestId("property-bathrooms").fill("1");
  await page.getByTestId("property-full_address").fill("Rua Isolamento 50");
  await page.getByTestId("property-neighborhood").fill("Centro");
  await page.getByTestId("property-city").fill("Palmas");
  await page.getByTestId("property-state").fill("TO");
  await page
    .getByTestId("property-location_map_url")
    .fill("https://maps.google.com/?q=-10.2,-48.3");
  await page.getByTestId("property-submit-create-top").click();
  await page.waitForURL(/\/properties\/[0-9a-f-]+/, { timeout: 60_000 });
  return page.url();
}

test("usuario B nao acessa imovel de A (404/redirect, sem formulario de edicao)", async ({
  page,
  browser,
}) => {
  requireStaging();

  await signupFree(page, userAEmail, userAPassword, userAWhatsapp, "Corretor Owner A");
  const propertyUrl = await createProperty(page, `QA Owner ${runId}`, `QA-OWN-${runId}`);
  expect(propertyUrl).toMatch(/\/properties\/[0-9a-f-]+/);

  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await signupFree(pageB, userBEmail, userBPassword, userBWhatsapp, "Intruso B");

  const response = await pageB.goto(propertyUrl);
  const status = response?.status() ?? 0;
  await pageB.waitForLoadState("domcontentloaded");

  const hasEditForm = await pageB.getByText(/Edi(c|ç)(a|ã)o completa do im(o|ó)vel/i).count();
  const hasPropertyTitle = await pageB.getByTestId("property-detail-title").count();
  const hasSafeNotFound = await pageB
    .getByText(/404|n(a|ã)o encontrado|im(o|ó)vel n(a|ã)o encontrado|not found/i)
    .count();
  const blocked =
    status === 404 ||
    pageB.url().includes("/login") ||
    !pageB.url().includes("/properties/") ||
    hasSafeNotFound > 0;

  fs.mkdirSync(evidenceDir, { recursive: true });
  await pageB.screenshot({
    path: path.join(evidenceDir, "10-isolamento-usuario-b-bloqueado.png"),
    fullPage: true,
  });

  expect(hasEditForm).toBe(0);
  expect(hasPropertyTitle).toBe(0);
  expect(blocked).toBeTruthy();

  await ctxB.close();
});
