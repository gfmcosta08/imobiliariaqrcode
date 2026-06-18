import { expect, test, type Page } from "@playwright/test";
import fs from "fs";
import path from "path";

const baseURL = process.env.STAGING_BASE_URL ?? "";
const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "";
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? "";
const writeEnabled = process.env.E2E_STAGING_WRITE === "1";
const stripeE2E = process.env.E2E_STRIPE_CHECKOUT === "1";
const runId = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
const evidenceDir = path.resolve(
  process.cwd(),
  "../../../qa-evidencias/rodada-pr9",
);

const freeEmail = `qa.novo.${runId}@teste.com`;
const freePassword = `TesteQA123!${runId.slice(-4)}`;
const brokerEmail = `qa.convite.${runId}@teste.com`;
const brokerPassword = `TesteQA123!${runId.slice(-4)}`;
const brokerWhatsapp = `7198${runId.slice(-8)}`;

let inviteLoginCode = "";
let inviteAccessCode = "";
let property1Title = `QA Convite1 ${runId}`;
let property2Title = `QA Convite2 ${runId}`;
let property1Code = `QA-C1-${runId}`;
let property2Code = `QA-C2-${runId}`;
let qrPublicUrl = "";
let propertyPublicId = "";

test.describe.configure({ mode: "serial" });

async function snap(page: Page, name: string) {
  fs.mkdirSync(evidenceDir, { recursive: true });
  await page.screenshot({
    path: path.join(evidenceDir, `${name}.png`),
    fullPage: true,
  });
}

function requireStaging() {
  test.skip(!baseURL, "STAGING_BASE_URL");
  test.skip(!writeEnabled, "E2E_STAGING_WRITE=1");
  test.skip(/production|prod|imoveisqr\.com/i.test(baseURL), "producao");
  expect(baseURL).toContain("farollimoveis-staging");
}

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByTestId("login-identifier").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await page.waitForURL(/\/(dashboard|admin|properties|onboarding)/, { timeout: 60_000 });
}

async function fillProperty(page: Page, title: string, code: string) {
  await page.getByTestId("property-internal_code").fill(code);
  await page.getByTestId("property-property_type").selectOption("Residencial");
  await page.getByTestId("property-property_subtype").selectOption("Apartamento");
  await page.getByTestId("property-purpose").selectOption("sale");
  await page.getByTestId("property-listing_status").selectOption("published");
  await page.getByTestId("property-title").fill(title);
  await page.getByTestId("property-full_description").fill(`QA PR9 ${runId}`);
  await page.getByTestId("property-sale_price").fill("350000");
  await page.getByTestId("property-total_area_m2").fill("80");
  await page.getByTestId("property-bedrooms").fill("2");
  await page.getByTestId("property-bathrooms").fill("1");
  await page.getByTestId("property-full_address").fill("Rua QA 100");
  await page.getByTestId("property-neighborhood").fill("Centro");
  await page.getByTestId("property-city").fill("Palmas");
  await page.getByTestId("property-state").fill("TO");
  await page
    .getByTestId("property-location_map_url")
    .fill("https://maps.google.com/?q=-10.2,-48.3");
}

test.describe("PR9 QA staging completo", () => {
  test("01 health deep=2 extrator ok", async ({ request }) => {
    requireStaging();
    const res = await request.get("/api/health?deep=2");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.extrator).toBe("ok");
  });

  test("02 import sem sessao retorna 401", async ({ request }) => {
    requireStaging();
    const res = await request.post("/api/properties/import", {
      data: { url: "https://example.com/test" },
    });
    expect(res.status()).toBe(401);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("unauthorized");
  });

  test("03 login admin", async ({ page }) => {
    requireStaging();
    test.skip(!adminEmail || !adminPassword, "admin creds");
    await login(page, adminEmail, adminPassword);
    await expect(page.getByText(/Starter|starter_active|Dashboard|Imoveis/i).first()).toBeVisible();
    await snap(page, "03-login-admin");
  });

  test("04 cliente novo signup free", async ({ page }) => {
    requireStaging();
    await page.goto("/login");
    await page.getByRole("button", { name: "Cadastre-se" }).click();
    await page.getByTestId("signup-full-name").fill("Cliente QA Novo");
    await page.getByTestId("signup-whatsapp").fill("63999990001");
    await page.getByTestId("login-identifier").fill(freeEmail);
    await page.getByTestId("login-password").fill(freePassword);
    await page.locator("#signup-terms").check();
    await page.getByTestId("login-submit").click();
    await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
    await expect(page.getByText(/Free|1 anuncio|plano/i).first()).toBeVisible();
    await snap(page, "04-cliente-novo-dashboard");
  });

  test("05 convite criar editar imprimir cancelar", async ({ page }) => {
    requireStaging();
    test.skip(!adminEmail || !adminPassword, "admin creds");
    await login(page, adminEmail, adminPassword);
    await page.goto("/admin");
    await page.getByTestId("admin-invite-property-count").fill("2");
    await page.getByTestId("admin-invite-expiration-days").fill("30");
    await page.getByTestId("admin-invite-generate").click();
    await expect(page.getByTestId("admin-invite-result")).toBeVisible({ timeout: 60_000 });
    inviteLoginCode = (await page.getByTestId("admin-invite-login-code-print").innerText()).trim();
    inviteAccessCode = (await page.getByTestId("admin-invite-access-code-print").innerText()).trim();
    await snap(page, "05-convite-criado-impressao");

    await expect(page.getByTestId("admin-invite-print")).toBeVisible();
    await page.reload();
    const item = page.getByTestId("admin-invitation-item").filter({ hasText: inviteLoginCode });
    await expect(item).toBeVisible({ timeout: 30_000 });
    await item.getByTestId("admin-invitation-edit").click();
    await item.getByTestId("admin-invitation-property-count").fill("3");
    await item.getByRole("button", { name: /^Salvar$/i }).click();
    await expect(item.getByTestId("admin-invitation-edit")).toBeVisible({ timeout: 30_000 });
    await snap(page, "05-convite-editado");

    const cancelItem = page.getByTestId("admin-invitation-item").filter({ hasText: inviteLoginCode });
    page.once("dialog", (d) => d.accept());
    await cancelItem.getByTestId("admin-invitation-cancel").click();
    await expect(
      page.getByTestId("admin-invitation-item").filter({ hasText: inviteLoginCode }),
    ).toHaveCount(0, { timeout: 30_000 });
    await snap(page, "05-convite-cancelado");

    await page.getByTestId("admin-invite-property-count").fill("2");
    await page.getByTestId("admin-invite-expiration-days").fill("30");
    await page.getByTestId("admin-invite-generate").click();
    await expect(page.getByTestId("admin-invite-result")).toBeVisible({ timeout: 60_000 });
    inviteLoginCode = (await page.getByTestId("admin-invite-login-code-print").innerText()).trim();
    inviteAccessCode = (await page.getByTestId("admin-invite-access-code-print").innerText()).trim();
    await snap(page, "05-convite-novo-para-limite");
  });

  test("06 convite property_count 2 permite 2o e bloqueia 3o", async ({ page }) => {
    requireStaging();
    expect(inviteLoginCode).toMatch(/^\d{6,8}$/);
    await page.goto("/convite");
    await page.getByTestId("invite-login-code").fill(inviteLoginCode);
    await page.getByTestId("invite-access-code").fill(inviteAccessCode);
    await page.getByTestId("invite-submit").click();
    await page.waitForURL(/\/onboarding\/complete-profile/, { timeout: 60_000 });
    await page.getByTestId("onboarding-full-name").fill("Corretor QA Limite");
    await page.getByTestId("onboarding-email").fill(brokerEmail);
    await page.getByTestId("onboarding-whatsapp").fill(brokerWhatsapp);
    await page.getByTestId("onboarding-password").fill(brokerPassword);
    await page.getByTestId("onboarding-confirm-password").fill(brokerPassword);
    const terms = page.locator("#onboarding-terms, input[type='checkbox']");
    if ((await terms.count()) > 0) await terms.first().check();
    await page.getByTestId("onboarding-submit").click();
    await page.waitForURL(/\/onboarding\/complete-listing/, { timeout: 60_000 });
    await fillProperty(page, property1Title, property1Code);
    await page.getByTestId("property-submit-edit-top").click();
    await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
    await snap(page, "06-primeiro-imovel-ok");

    await page.goto("/properties/new");
    await fillProperty(page, property2Title, property2Code);
    await page.getByTestId("property-submit-create-top").click();
    await page.waitForURL(/\/properties\/[0-9a-f-]+/, { timeout: 60_000 });
    await snap(page, "06-segundo-imovel-ok");

    await page.goto("/properties/new");
    await fillProperty(page, `QA Terceiro ${runId}`, `QA-C3-${runId}`);
    await page.getByTestId("property-submit-create-top").click();
    await expect(page.getByText(/permite apenas|limite|plano atual/i).first()).toBeVisible({
      timeout: 30_000,
    });
    await snap(page, "06-terceiro-imovel-bloqueado");
  });

  test("07 upload de imagens", async ({ page }) => {
    requireStaging();
    await login(page, brokerEmail, brokerPassword);
    await page.goto("/properties");
    await page.getByTestId("properties-list-item").filter({ hasText: property2Title }).first().click();
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
      "base64",
    );
    await page.getByTestId("property-media-files-input").setInputFiles({
      name: "qa-pr9.png",
      mimeType: "image/png",
      buffer: png,
    });
    await expect(page.getByTestId("property-media-count")).toContainText(/1\//, { timeout: 60_000 });
    await snap(page, "07-upload-imagem");
    propertyPublicId = (await page.getByTestId("property-detail-public-id").innerText()).trim();
    qrPublicUrl = (await page.getByTestId("qr-print-public-url").innerText()).trim();
  });

  test("08 importacao anuncios sonhar", async ({ page }) => {
    requireStaging();
    test.skip(!adminEmail || !adminPassword, "admin creds");
    await login(page, adminEmail, adminPassword);
    await page.goto("/properties");
    await page.getByTestId("import-listings-open").click();
    await page
      .getByTestId("import-listings-url")
      .fill(
        "https://imobiliariasonhar.com.br/imovel/apartamento-palmas-2-quartos-65-m/AP0029-SOOR",
      );
    await page.getByTestId("import-listings-submit").click();
    const jobBox = page.getByTestId("import-job-status");
    await expect(jobBox).toBeVisible({ timeout: 60_000 });
    await expect
      .poll(
        async () => {
          const t = (await jobBox.innerText()).toLowerCase();
          return t.includes("completed") || t.includes("failed") ? "done" : "running";
        },
        { timeout: 6 * 60_000, intervals: [2000, 5000] },
      )
      .toBe("done");
    await snap(page, "08-importacao-concluida");
    const openLink = jobBox.locator("a", { hasText: /abrir/i }).first();
    await expect(openLink).toBeVisible();
    const href = await openLink.getAttribute("href");
    expect(href).toBeTruthy();
    await page.goto(href!);
    await expect(page.getByTestId("property-detail-title")).toBeVisible();
    await snap(page, "08-importacao-imovel-detalhe");
  });

  test("09 leads via API publica e lista do corretor", async ({ page, request }) => {
    requireStaging();
    expect(qrPublicUrl).toContain("/q/");
    const token = qrPublicUrl.split("/q/")[1]?.split(/[?#]/)[0] ?? "";
    expect(token.length).toBeGreaterThan(5);

    const leadRes = await request.post("/api/public/lead", {
      data: {
        qr_token: token,
        client_phone: "63999887766",
        nome: "Lead QA PR9",
        observation: `Interesse QA ${runId}`,
        intent: "visit_interest",
      },
    });
    expect(leadRes.status()).toBeLessThan(500);
    const leadBody = await leadRes.json();
    expect(leadBody.ok ?? leadBody.lead_id).toBeTruthy();

    await login(page, brokerEmail, brokerPassword);
    await page.goto("/leads");
    await expect(page.getByText(/Lead QA PR9|63999887766/i).first()).toBeVisible({
      timeout: 30_000,
    });
    await snap(page, "09-leads-lista");
  });

  test("10 isolamento usuario B nao acessa imovel de A", async ({ page, browser }) => {
    requireStaging();
    await login(page, brokerEmail, brokerPassword);
    await page.goto("/properties");
    await page.getByTestId("properties-list-item").filter({ hasText: property2Title }).first().click();
    await page.waitForURL(/\/properties\/[0-9a-f-]+/, { timeout: 30_000 });
    const brokerPropertyUrl = page.url();
    expect(brokerPropertyUrl).toMatch(/\/properties\/[0-9a-f-]+/);

    const ctxB = await browser.newContext();
    const pageB = await ctxB.newPage();
    await pageB.goto(`${baseURL}/login`);
    await pageB.getByTestId("login-identifier").fill(freeEmail);
    await pageB.getByTestId("login-password").fill(freePassword);
    await pageB.getByTestId("login-submit").click();
    await pageB.waitForURL(/\/dashboard/, { timeout: 60_000 });
    await pageB.goto(brokerPropertyUrl);
    await pageB.waitForLoadState("domcontentloaded");

    const hasEditForm = await pageB.getByText(/Edicao completa do imovel/i).count();
    const hasPropertyTitle = await pageB.getByTestId("property-detail-title").count();
    const blocked =
      pageB.url().includes("/login") ||
      !pageB.url().includes(brokerPropertyUrl.split("/properties/")[1] ?? "___") ||
      (await pageB.getByText(/404|nao encontrado|not found/i).count()) > 0;

    expect(hasEditForm).toBe(0);
    expect(hasPropertyTitle).toBe(0);
    expect(blocked).toBeTruthy();
    await pageB.screenshot({
      path: path.join(evidenceDir, "10-isolamento-usuario-b-bloqueado.png"),
      fullPage: true,
    });
    await ctxB.close();
  });
});
