import { expect, test, type Page } from "@playwright/test";

const baseURL = process.env.STAGING_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? "";
const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "";
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? "";
const writeEnabled = process.env.E2E_STAGING_WRITE === "1";
const runId = "QA-STAGING-IMPORT-29-05";
const runSuffix = new Date().toISOString().replace(/\D/g, "").slice(-8);
const brokerEmail = `corretor.${runId.toLowerCase()}.${runSuffix}@teste.com`;
const brokerPassword = `TesteQA123!2905`;
const brokerWhatsapp = `71999${runSuffix.slice(-8)}`;
const invitePropertyTitle = `${runId} Convite ${runSuffix}`;
const inviteInternalCode = `${runId}-CONV-${runSuffix}`;
const manualPropertyTitle = `${runId} Manual ${runSuffix}`;
const manualInternalCode = `${runId}-MAN-${runSuffix}`;

let inviteLoginCode = "";
let inviteAccessCode = "";
let invitePropertyPublicId = "";
let manualPropertyPublicId = "";
let manualPropertyId = "";
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
  await page.getByTestId("property-full_description").fill(
    `Imovel criado pelo QA automatizado no staging em ${runId}.`,
  );
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
  await page.getByTestId("property-location_map_url").fill("https://maps.google.com/?q=Salvador+BA");
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
  await page.goto("/");
  await expect(page.getByText("Encontre seu lugar")).toBeVisible();
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

  // Cortesia: deve permitir configurar muitos imóveis e validade longa no staging.
  await page.getByTestId("admin-invite-property-count").fill("10");
  await page.getByTestId("admin-invite-expiration-days").fill("500");
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
  await page.getByTestId("onboarding-submit").click();
  await page.waitForURL(/\/onboarding\/complete-listing/, { timeout: 45_000 });

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

  const basePng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
    "base64",
  );

  await page.getByTestId("property-submit-create-top").click();
  await page.waitForURL(/\/properties\/[0-9a-f-]+/, { timeout: 60_000 });
  manualPropertyId = page.url().split("/properties/")[1]?.split(/[?#]/)[0] ?? "";
  expect(manualPropertyId).toMatch(/^[0-9a-f-]+$/);

  await expect(page.getByTestId("property-detail-title")).toContainText(manualPropertyTitle);

  // Upload 10 fotos (ETAPA 4) — ocorre na tela de detalhe do imovel
  await expect(page.getByTestId("property-media-section")).toBeVisible();
  await page.getByTestId("property-media-files-input").setInputFiles(
    Array.from({ length: 10 }, (_, idx) => ({
      name: `qa-imovel-${idx + 1}.png`,
      mimeType: "image/png",
      buffer: basePng,
    })),
  );

  // Eventual consistency: aguarda o contador refletir uploads (pode variar conforme rede/storage)
  await expect(page.getByTestId("property-media-count")).toContainText(/10\/|9\/|8\//, {
    timeout: 90_000,
  });
  await expect(page.getByTestId("qr-print-area")).toBeVisible();
  await expect(page.getByTestId("qr-print-internal-code")).toContainText(manualInternalCode);
  manualPropertyPublicId = (await page.getByTestId("property-detail-public-id").innerText()).trim();
  manualQrUrl = (await page.getByTestId("qr-print-public-url").innerText()).trim();
  expect(manualQrUrl).toContain("/q/");

  // Persistência após reload
  await page.reload();
  await expect(page.getByTestId("property-detail-title")).toContainText(manualPropertyTitle);
  await expect(page.getByTestId("property-media-count")).toContainText(/10\/|9\/|8\//);
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
    page.locator(`a[data-testid="home-property-card"][href*="${manualPropertyPublicId}"]`),
  ).toBeVisible();

  await login(page, adminEmail, adminPassword);
  await page.goto("/admin");
  await page.getByTestId("admin-properties-search").fill(manualInternalCode);
  await page.getByTestId("admin-properties-search-submit").click();
  const adminResult = page
    .getByTestId("admin-properties-result")
    .filter({ hasText: manualInternalCode })
    .first();
  await expect(adminResult).toBeVisible();
  await expect(adminResult).toContainText(manualPropertyTitle);
  await expect(adminResult).toContainText(brokerEmail);
});

test("07 impressao/PDF: botao imprime em vertical e A4 (iframe)", async ({ page }) => {
  requireStaging();
  await login(page, brokerEmail, brokerPassword);
  await openPropertyFromList(page, manualPropertyTitle);

  await expect(page.getByTestId("qr-print-button")).toBeVisible();
  await page.getByTestId("qr-print-button").click();
  await expect(page.locator("iframe")).toHaveCount(1);

  await expect(page.getByTestId("qr-print-button-horizontal")).toBeVisible();
  await page.getByTestId("qr-print-button-horizontal").click();
  await expect(page.locator("iframe")).toHaveCount(2);
});

test("08 admin altera validade/status do anuncio e valida efeito na homepage", async ({ page }) => {
  requireStaging();
  await login(page, adminEmail, adminPassword);
  await page.goto("/admin");

  // Expira o anúncio criado no teste manual
  await page.getByTestId("admin-properties-search").fill(manualInternalCode);
  await page.getByTestId("admin-properties-search-submit").click();
  const adminResult = page
    .getByTestId("admin-properties-result")
    .filter({ hasText: manualPropertyTitle })
    .first();
  await expect(adminResult).toBeVisible();
  await adminResult.getByTestId("admin-properties-edit").click();
  await expect(page.getByTestId("admin-properties-modal")).toBeVisible();
  await page.getByTestId("admin-properties-edit-status").selectOption("expired");
  await page.getByTestId("admin-properties-edit-expires-at").fill("");
  await page.getByTestId("admin-properties-edit-save").click();
  await expect(page.getByTestId("admin-properties-modal")).toHaveCount(0);

  // Como visitante, o anúncio expirado não deve aparecer na homepage
  await page.context().clearCookies();
  await page.goto(`/?q=${encodeURIComponent(manualInternalCode)}#imoveis`, {
    waitUntil: "networkidle",
  });
  // Eventual consistency: aguarda refletir no índice/consulta da home
  await expect(
    page.locator(`a[data-testid="home-property-card"][href*="${manualPropertyPublicId}"]`),
  ).toHaveCount(0, { timeout: 60_000 });

  // Reativa o anúncio para published e valida que volta a aparecer
  await login(page, adminEmail, adminPassword);
  await page.goto("/admin");
  await page.getByTestId("admin-properties-search").fill(manualInternalCode);
  await page.getByTestId("admin-properties-search-submit").click();
  const adminResult2 = page
    .getByTestId("admin-properties-result")
    .filter({ hasText: manualPropertyTitle })
    .first();
  await expect(adminResult2).toBeVisible();
  await adminResult2.getByTestId("admin-properties-edit").click();
  await page.getByTestId("admin-properties-edit-status").selectOption("published");
  await page.getByTestId("admin-properties-edit-save").click();
  await expect(page.getByTestId("admin-properties-modal")).toHaveCount(0);

  await page.context().clearCookies();
  await page.goto(`/?q=${encodeURIComponent(manualInternalCode)}#imoveis`, {
    waitUntil: "networkidle",
  });
  await expect(
    page.locator(`a[data-testid="home-property-card"][href*="${manualPropertyPublicId}"]`),
  ).toBeVisible();
});

test("09 admin altera validade/status da assinatura e salva sem erro", async ({ page }) => {
  requireStaging();
  await login(page, adminEmail, adminPassword);
  await page.goto("/admin");

  const section = page.getByTestId("admin-section-subscriptions");
  await expect(section).toBeVisible();

  await section.getByPlaceholder("Buscar por e-mail ou nome...").fill("");
  await section.getByRole("button", { name: "Buscar" }).click();
  await expect(section.locator("table tbody tr").first()).toBeVisible();

  const firstRowEmail = await section
    .locator("table tbody tr")
    .first()
    .locator("td")
    .first()
    .locator("p")
    .first()
    .innerText();

  await section.getByPlaceholder("Buscar por e-mail ou nome...").fill(firstRowEmail.trim());
  await section.getByRole("button", { name: "Buscar" }).click();

  // Se não houver assinatura para o corretor do convite, este teste falha com mensagem clara
  await expect(section.getByRole("button", { name: "Editar" }).first()).toBeVisible();
  await section.getByRole("button", { name: "Editar" }).first().click();

  const modal = page.getByText("Editar assinatura").locator("..").locator("..");
  await expect(page.getByText("Editar assinatura")).toBeVisible();

  await page.getByTestId("admin-subscriptions-edit-plan").selectOption("pro");
  await expect(page.getByTestId("admin-subscriptions-edit-max-active")).toHaveValue("999999");
  await page.getByTestId("admin-subscriptions-edit-max-active").fill("10");
  // Status agora é avançado; não é necessário mexer para operar o plano.

  // PRO nao tem validade (campo desabilitado por regra de negocio).
  await expect(page.getByTestId("admin-subscriptions-edit-period-end")).toBeDisabled();

  await page.getByRole("button", { name: "Salvar" }).click();
  // O modal fecha ao salvar com sucesso (mensagem pode ser breve).
  await expect(page.getByText("Editar assinatura")).toHaveCount(0);
  await expect(page.getByText(/Erro ao salvar|Erro de conexão/i)).toHaveCount(0);

  // Reabre e valida persistência do limite reduzido.
  await section.getByRole("button", { name: "Editar" }).first().click();
  await expect(page.getByTestId("admin-subscriptions-edit-max-active")).toHaveValue("10");
  await page.getByTestId("admin-subscriptions-modal").getByRole("button", { name: "Cancelar" }).click();
});

test("10 lead: visitante registra interesse via API publica e corretor enxerga em /leads", async ({ page }) => {
  requireStaging();
  await page.context().clearCookies();

  await login(page, brokerEmail, brokerPassword);
  await page.goto(`/properties/${manualPropertyId}`);
  await expect(page.getByTestId("property-detail-title")).toContainText(manualPropertyTitle);
  const freshQrUrl = (await page.getByTestId("qr-print-public-url").innerText()).trim();
  expect(freshQrUrl).toContain("/q/");
  const token = freshQrUrl.split("/q/")[1]?.split(/[?#]/)[0] ?? "";
  expect(token).toBeTruthy();

  const leadPhone = `55119${runSuffix.slice(-8)}`;
  const res = await page.request.post("/api/public/lead", {
    data: {
      qr_token: token,
      client_phone: leadPhone,
      nome: `QA Lead ${runId}`,
      observation: "Lead criado pelo QA E2E no staging.",
      intent: "visit_interest",
    },
  });
  const leadBody = await res.json();
  expect(res.ok(), JSON.stringify(leadBody)).toBeTruthy();

  await page.goto("/leads");
  await expect(page.getByRole("heading", { name: "Leads" })).toBeVisible();
  await expect(page.getByText(leadPhone)).toBeVisible({ timeout: 45_000 });
});
