import { expect, test, type Page } from "@playwright/test";
import path from "path";

const baseURL = process.env.STAGING_BASE_URL ?? "";
const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "";
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? "";
const writeEnabled = process.env.E2E_STAGING_WRITE === "1";
const stripeE2E = process.env.E2E_STRIPE_CHECKOUT === "1";
const runId = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
const screenshotDir = path.join("qa-output", "e2e-screenshots", runId);

const freeUserEmail = `free.qa.${runId}@teste.com`;
const freeUserPassword = `TesteQA123!${runId.slice(-4)}`;
const brokerEmail = `convite.qa.${runId}@teste.com`;
const brokerPassword = `TesteQA123!${runId.slice(-4)}`;
const brokerWhatsapp = `7198${runId.slice(-8)}`;

let inviteLoginCode = "";
let inviteAccessCode = "";
let propertyPublicUrl = "";
let propertyTitle = `QA E2E ${runId}`;

test.describe.configure({ mode: "serial" });

function requireStaging() {
  test.skip(!baseURL, "Defina STAGING_BASE_URL.");
  test.skip(!writeEnabled, "Defina E2E_STAGING_WRITE=1.");
  test.skip(/production|prod|imoveisqr\.com/i.test(baseURL), "Base URL parece producao.");
  expect(baseURL).toContain("farollimoveis-staging");
}

async function snap(page: Page, name: string) {
  await page.screenshot({ path: path.join(screenshotDir, `${name}.png`), fullPage: true });
}

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByTestId("login-identifier").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await page.waitForURL(/\/(dashboard|admin|properties|onboarding)/, { timeout: 60_000 });
}

test.describe("QA compliance staging", () => {
  test("00 ambiente e paginas publicas", async ({ page }) => {
    requireStaging();
    expect(baseURL).not.toMatch(/imoveisqr\.com|farollimoveis\.vercel\.app$/);
    const paths = [
      "/",
      "/plans",
      "/termos",
      "/privacidade",
      "/cancelamento-reembolso",
      "/remocao-de-conteudo",
      "/login",
    ];
    for (const p of paths) {
      const res = await page.goto(p);
      expect(res?.status(), p).toBeLessThan(500);
      await snap(page, `public-${p.replace(/\//g, "_") || "home"}`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByText(/Cole esse QR|ImoveisQR/i).first()).toBeVisible();
    await snap(page, "public-home-mobile");
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("01 cadastro exige aceite legal", async ({ page }) => {
    requireStaging();
    await page.goto("/login");
    await page.getByRole("button", { name: "Cadastre-se" }).click();
    await page.getByTestId("signup-full-name").fill("Usuario QA Free");
    await page.getByTestId("signup-whatsapp").fill("71999990000");
    await page.getByTestId("login-identifier").fill(freeUserEmail);
    await page.getByTestId("login-password").fill(freeUserPassword);
    await page.getByTestId("login-submit").click();
    await expect(page.locator('p[role="alert"]')).toContainText(/aceitar|Termos|Privacidade/i);
    await snap(page, "signup-sem-aceite");

    await page.locator("#signup-terms").check();
    await page.getByTestId("login-submit").click();
    await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
    await expect(page.getByText(/Free|1 anuncio|plano/i).first()).toBeVisible({ timeout: 15_000 });
    await snap(page, "dashboard-free-pos-cadastro");
  });

  test("02 admin gera convite e edita pendente", async ({ page }) => {
    requireStaging();
    test.skip(!adminEmail || !adminPassword, "E2E_ADMIN_EMAIL/PASSWORD");
    await login(page, adminEmail, adminPassword);
    await page.goto("/admin");
    await page.getByTestId("admin-invite-property-count").fill("2");
    await page.getByTestId("admin-invite-expiration-days").fill("45");
    await page.getByTestId("admin-invite-generate").click();
    await expect(page.getByTestId("admin-invite-result")).toBeVisible({ timeout: 60_000 });
    inviteLoginCode = (await page.getByTestId("admin-invite-login-code").innerText()).trim();
    inviteAccessCode = (await page.getByTestId("admin-invite-access-code").innerText()).trim();
    expect(inviteLoginCode).toMatch(/^\d{6}$/);

    await page.reload();
    const newInvite = page
      .getByTestId("admin-invitation-item")
      .filter({ hasText: inviteLoginCode });
    await expect(newInvite).toBeVisible();
    await newInvite.getByTestId("admin-invitation-edit").click();
    await newInvite.getByTestId("admin-invitation-property-count").fill("3");
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 60);
    const isoDate = futureDate.toISOString().slice(0, 10);
    await newInvite.getByTestId("admin-invitation-expires-at").fill(isoDate);
    await page.getByRole("button", { name: /Salvar/i }).click();
    await snap(page, "admin-convite-editado");
  });

  test("03 convidado completa onboarding e respeita limite", async ({ page }) => {
    requireStaging();
    expect(inviteLoginCode).toMatch(/^\d{6}$/);
    await page.goto("/convite");
    await page.getByTestId("invite-login-code").fill(inviteLoginCode);
    await page.getByTestId("invite-access-code").fill(inviteAccessCode);
    await page.getByTestId("invite-submit").click();
    await page.waitForURL(/\/onboarding\/complete-profile/, { timeout: 60_000 });
    await page.getByTestId("onboarding-full-name").fill("Convidado QA");
    await page.getByTestId("onboarding-email").fill(brokerEmail);
    await page.getByTestId("onboarding-whatsapp").fill(brokerWhatsapp);
    await page.getByTestId("onboarding-password").fill(brokerPassword);
    await page.getByTestId("onboarding-confirm-password").fill(brokerPassword);
    const onboardingTerms = page.locator("#onboarding-terms, input[type='checkbox']");
    if ((await onboardingTerms.count()) > 0) {
      await onboardingTerms.first().check();
    }
    await page.getByTestId("onboarding-submit").click();
    const onboardingError = page.locator("p.text-red-600");
    await Promise.race([
      page.waitForURL(/\/onboarding\/complete-listing/, { timeout: 60_000 }),
      onboardingError.waitFor({ state: "visible", timeout: 60_000 }).then(async () => {
        throw new Error(`Onboarding: ${await onboardingError.innerText()}`);
      }),
    ]);
    await snap(page, "onboarding-listing");
  });

  test("04 checkout starter exige aceite legal", async ({ page }) => {
    requireStaging();
    await login(page, brokerEmail, brokerPassword);
    await page.goto("/plans");
    await page.getByRole("button", { name: /Ver resumo antes do pagamento/i }).click();
    await page.getByRole("button", { name: /Assinar Starter/i }).click();
    await expect(page.getByText(/Aceite os documentos legais/i)).toBeVisible();
    await snap(page, "checkout-sem-aceite");
  });

  test("05 stripe checkout teste (opcional)", async ({ page }) => {
    requireStaging();
    test.skip(!stripeE2E, "Defina E2E_STRIPE_CHECKOUT=1 para fluxo Stripe completo.");
    await login(page, brokerEmail, brokerPassword);
    await page.goto("/plans");
    await page.getByRole("button", { name: /Ver resumo antes do pagamento/i }).click();
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    for (let i = 0; i < count; i++) {
      const box = checkboxes.nth(i);
      if (!(await box.isChecked())) await box.check();
    }
    await page.getByRole("button", { name: /Assinar Starter/i }).click();
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 60_000 });
    await snap(page, "stripe-checkout");
    // Stripe Checkout test mode — preenche cartao padrao quando formulario visivel
    const card = page.frameLocator('iframe[name*="card"], iframe').first();
    try {
      await card
        .locator('[name="cardnumber"], input[placeholder*="1234"]')
        .fill("4242424242424242");
      await card.locator('[name="exp-date"], input[placeholder*="MM"]').fill("1234");
      await card.locator('[name="cvc"], input[placeholder*="CVC"]').fill("123");
    } catch {
      await page
        .locator('input[name="cardNumber"], input[autocomplete="cc-number"]')
        .fill("4242424242424242");
    }
    await page
      .getByRole("button", { name: /Pay|Pagar|Subscribe|Assinar/i })
      .click({ timeout: 30_000 });
    await page.waitForURL(/\/dashboard/, { timeout: 120_000 });
    await expect(page.getByText(/Starter|starter_active/i).first()).toBeVisible({
      timeout: 30_000,
    });
    await snap(page, "dashboard-starter-pos-checkout");
  });
});
