import { expect, test, type Page } from "@playwright/test";

const baseURL = process.env.STAGING_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? "";
const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "";
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? "";
const writeEnabled = process.env.E2E_STAGING_WRITE === "1";
const runId = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
const brokerEmail = `corretor.qa.${runId}@teste.com`;
const brokerPassword = `TesteQA123!${runId.slice(-4)}`;
const brokerWhatsapp = `7198${runId.slice(-8)}`;
const invitePropertyTitle = `QA Convite ${runId}`;
const inviteInternalCode = `QA-CONV-${runId}`;
const manualPropertyTitle = `QA Manual ${runId}`;
const manualInternalCode = `QA-MAN-${runId}`;

let inviteLoginCode = "";
let inviteAccessCode = "";
let invitePropertyPublicId = "";
let manualPropertyPublicId = "";
let manualQrUrl = "";

test.describe.configure({ mode: "serial" });

function requireStaging() {
  test.skip(!baseURL, "Defina STAGING_BASE_URL para rodar E2E no Preview/staging.");
  test.skip(!adminEmail || !adminPassword, "Defina E2E_ADMIN_EMAIL e E2E_ADMIN_PASSWORD.");
  test.skip(!writeEnabled, "Defina E2E_STAGING_WRITE=1 para permitir criacao de dados de QA.");
  test.skip(/production|prod/i.test(baseURL), "Base URL parece producao; teste bloqueado.");
}

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByTestId("login-identifier").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await page.waitForURL(/\/(dashboard|admin|properties)/, { timeout: 45_000 });
}

async function fillCorePropertyFields(page: Page, title: string, internalCode: string) {
  await page.getByTestId("property-internal_code").fill(internalCode);
  await page.getByTestId("property-property_type").selectOption("Residencial");
  await expect(page.getByTestId("property-property_type")).toHaveValue("Residencial");
  await page.getByTestId("property-property_subtype").selectOption("Apartamento");
  await expect(page.getByTestId("property-property_subtype")).toHaveValue("Apartamento");
  await page.getByTestId("property-purpose").selectOption("sale");
  await expect(page.getByTestId("property-purpose")).toHaveValue("sale");
  await page.getByTestId("property-listing_status").selectOption("published");
  await expect(page.getByTestId("property-listing_status")).toHaveValue("published");
  await page.getByTestId("property-title").fill(title);
  await page
    .getByTestId("property-full_description")
    .fill(`Imovel criado pelo QA automatizado no staging em ${runId}.`);
  await page.getByTestId("property-highlights").fill("varanda\nvista livre\nperto de comercio");
  await page.getByTestId("property-sale_price").fill("850000");
  await page.getByTestId("property-sale_price").blur();
  await expect(page.getByTestId("property-sale_price")).toHaveValue(/850\.000,00/);
  await page.getByTestId("property-total_area_m2").fill("120");
  await page.getByTestId("property-total_area_m2").blur();
  await expect(page.getByTestId("property-total_area_m2")).toHaveValue("120");
  await page.getByTestId("property-built_area_m2").fill("100");
  await page.getByTestId("property-built_area_m2").blur();
  await expect(page.getByTestId("property-built_area_m2")).toHaveValue("100");
  await page.getByTestId("property-bedrooms").fill("3");
  await page.getByTestId("property-bathrooms").fill("2");
  await page.getByTestId("property-parking_spaces").fill("2");
  await page.getByTestId("property-full_address").fill("Rua QA Staging, 123");
  await page.getByTestId("property-neighborhood").fill("Centro");
  await page.getByTestId("property-city").fill("Salvador");
  await page.getByTestId("property-state").fill("BA");
  await page
    .getByTestId("property-location_map_url")
    .fill("https://maps.google.com/?q=Salvador+BA");
}

async function openPropertyFromList(page: Page, title: string) {
  await page.goto("/properties");
  const item = page.getByTestId("properties-list-item").filter({ hasText: title }).first();
  await expect(item).toBeVisible();
  await item.click();
  await expect(page.getByTestId("property-detail-title")).toContainText(title);
}

test("01 homepage publica carrega busca e filtros", async ({ page }) => {
  requireStaging();
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/Cole esse QR no imovel/i)).toBeVisible();
  await page.getByTestId("home-hero-search").fill("Salvador");
  await page.getByTestId("home-hero-search-submit").click();
  await expect(page).toHaveURL(/q=Salvador/);
  await expect(page.getByTestId("home-filters-form")).toBeVisible();
  await page.getByTestId("home-filter-purpose").selectOption("sale");
  await expect(page.getByTestId("home-filter-purpose")).toHaveValue("sale");
});

test("02 admin acessa painel e gera convite cortesia", async ({ page }) => {
  requireStaging();
  await login(page, adminEmail, adminPassword);
  await page.goto("/admin");
  await expect(page.getByTestId("admin-section-plans")).toBeVisible();
  await expect(page.getByTestId("admin-section-subscriptions")).toBeVisible();
  await expect(page.getByTestId("admin-section-properties")).toBeVisible();
  await expect(page.getByTestId("admin-section-invitations")).toBeVisible();

  await page.getByTestId("admin-invite-property-count").fill("2");
  await page.getByTestId("admin-invite-expiration-days").fill("30");
  await page.getByTestId("admin-invite-generate").click();
  await expect(page.getByTestId("admin-invite-result")).toBeVisible({ timeout: 60_000 });

  inviteLoginCode = (await page.getByTestId("admin-invite-login-code").innerText()).trim();
  inviteAccessCode = (await page.getByTestId("admin-invite-access-code").innerText()).trim();
  expect(inviteLoginCode).toMatch(/^\d{6}$/);
  expect(inviteAccessCode).toMatch(/^\d{6}$/);
});

test("03 formulario mostra mensagem oficial para localizacao obrigatoria", async ({ page }) => {
  requireStaging();
  await login(page, adminEmail, adminPassword);
  await page.goto("/properties/new");
  await page.getByTestId("property-title").fill(`QA sem localizacao ${runId}`);
  await page.getByTestId("property-purpose").selectOption("sale");
  await page.getByTestId("property-listing_status").selectOption("published");
  await page.getByTestId("property-submit-create-top").click();
  await expect(page.getByTestId("property-location_map_url")).toBeFocused();
  await expect(page.getByTestId("property-location_map_url")).toHaveJSProperty(
    "validationMessage",
    "Informe a localização do imóvel.",
  );
});

test("04 corretor usa convite completa perfil e publica anuncio inicial", async ({ page }) => {
  requireStaging();
  expect(inviteLoginCode).toMatch(/^\d{6}$/);

  await page.goto("/convite");
  await page.getByTestId("invite-login-code").fill(inviteLoginCode);
  await page.getByTestId("invite-access-code").fill(inviteAccessCode);
  await page.getByTestId("invite-submit").click();
  await page.waitForURL(/\/onboarding\/complete-profile/, { timeout: 45_000 });

  await page.getByTestId("onboarding-full-name").fill("Corretor QA Staging");
  await page.getByTestId("onboarding-email").fill(brokerEmail);
  await page.getByTestId("onboarding-whatsapp").fill(brokerWhatsapp);
  await page.getByTestId("onboarding-password").fill(brokerPassword);
  await page.getByTestId("onboarding-confirm-password").fill(brokerPassword);
  const onboardingTerms = page.locator("#onboarding-terms, input[type='checkbox']");
  if ((await onboardingTerms.count()) > 0) {
    await onboardingTerms.first().check();
  }
  await page.getByTestId("onboarding-submit").click();
  await page.waitForURL(/\/onboarding\/complete-listing/, { timeout: 60_000 });

  await fillCorePropertyFields(page, invitePropertyTitle, inviteInternalCode);
  await page.getByTestId("property-submit-edit-top").click();
  await page.waitForURL(/\/dashboard/, { timeout: 45_000 });

  await openPropertyFromList(page, invitePropertyTitle);
  invitePropertyPublicId = (await page.getByTestId("property-detail-public-id").innerText()).trim();
  await expect(page.getByTestId("qr-print-area")).toBeVisible();
  await expect(page.getByTestId("qr-print-internal-code")).toContainText(inviteInternalCode);
});

test("05 corretor cria segundo anuncio com imagem, QR e dados persistidos", async ({ page }) => {
  requireStaging();
  await login(page, brokerEmail, brokerPassword);
  await page.goto("/properties/new");
  await fillCorePropertyFields(page, manualPropertyTitle, manualInternalCode);
  await page.getByTestId("property-submit-create-top").click();
  await page.waitForURL(/\/properties\/[0-9a-f-]+/, { timeout: 60_000 });

  await expect(page.getByTestId("property-detail-title")).toContainText(manualPropertyTitle);
  const pngBuffer = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
    "base64",
  );
  await page.getByTestId("property-media-files-input").setInputFiles({
    name: "qa-imovel.png",
    mimeType: "image/png",
    buffer: pngBuffer,
  });
  await expect(page.getByTestId("property-media-count")).toContainText(/1\/|2\/|3\//, {
    timeout: 60_000,
  });
  await expect(page.getByTestId("qr-print-area")).toBeVisible();
  await expect(page.getByTestId("qr-print-internal-code")).toContainText(manualInternalCode);
  manualPropertyPublicId = (await page.getByTestId("property-detail-public-id").innerText()).trim();
  manualQrUrl = (await page.getByTestId("qr-print-public-url").innerText()).trim();
  expect(manualQrUrl).toContain("/q/");
});

test("06 QR, pagina publica, homepage e admin encontram o anuncio", async ({ page, context }) => {
  requireStaging();
  expect(manualPropertyPublicId).toMatch(/^IMV-/);
  expect(manualQrUrl).toContain("/q/");

  const qrPage = await context.newPage();
  await qrPage.goto(manualQrUrl);
  await expect(qrPage.getByRole("heading", { name: manualPropertyTitle })).toBeVisible({
    timeout: 15_000,
  });
  await expect(qrPage.getByText(`Ref. ${manualPropertyPublicId}`)).toBeVisible();
  await expect(qrPage.getByText(/Falha ao validar QR|HTTP 404/i)).toHaveCount(0);
  await qrPage.close();

  await page.goto(`/imoveis/${encodeURIComponent(manualPropertyPublicId)}`);
  await expect(page.getByTestId("public-property-title")).toContainText(manualPropertyTitle);
  await expect(page.getByTestId("public-property-location")).toContainText("Salvador");

  await page.goto(`/?q=${encodeURIComponent(manualInternalCode)}#imoveis`);
  await expect(
    page.getByTestId("home-property-card").filter({ hasText: manualPropertyTitle }),
  ).toBeVisible();

  await login(page, adminEmail, adminPassword);
  await page.goto("/admin");
  await page.getByTestId("admin-properties-search").fill(manualInternalCode);
  await page.getByTestId("admin-properties-search-submit").click();
  const adminResult = page
    .getByTestId("admin-properties-result")
    .filter({ hasText: manualPropertyTitle });
  await expect(adminResult).toBeVisible();
  await expect(adminResult).toContainText(manualInternalCode);
  await expect(adminResult).toContainText(brokerEmail);
});
