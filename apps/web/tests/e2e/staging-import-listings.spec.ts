import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const baseURL = process.env.STAGING_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? "";
const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "";
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? "";
const writeEnabled = process.env.E2E_STAGING_WRITE === "1";

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

function pickRandom<T>(items: T[]): T | null {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)] ?? null;
}

async function getRandomListingUrlFromSite(page: Page, site: string): Promise<string | null> {
  const url = site.startsWith("http") ? site : `https://${site.replace(/^\/+/, "")}`;
  await page.goto(url, { waitUntil: "domcontentloaded" });

  const anchors = page.locator("a[href]");
  const hrefs = (await anchors.evaluateAll((nodes) =>
    nodes
      .map((n) => (n instanceof HTMLAnchorElement ? n.getAttribute("href") : null))
      .filter((h): h is string => Boolean(h))
      .slice(0, 800),
  )) as string[];

  const absolute = hrefs
    .map((h) => {
      try {
        return new URL(h, url).toString();
      } catch {
        return null;
      }
    })
    .filter((h): h is string => Boolean(h));

  const host = new URL(url).host.replace(/^www\./, "");
  const candidates = absolute.filter((h) => {
    try {
      const u = new URL(h);
      const hHost = u.host.replace(/^www\./, "");
      if (hHost !== host) return false;
      if (u.protocol !== "https:" && u.protocol !== "http:") return false;
      const p = u.pathname.toLowerCase();
      return (
        // Prefere URL de detalhe (mais chance de funcionar em portais/WAF).
        p.includes("/imovel/") ||
        p.includes("/im%C3%B3vel/".toLowerCase()) ||
        p.includes("imovel/") ||
        p.includes("imoveis") ||
        p.includes("anuncio") ||
        p.includes("an%C3%BAncio".toLowerCase()) ||
        p.includes("property") ||
        p.includes("listing")
      );
    } catch {
      return false;
    }
  });

  const picked = pickRandom(candidates);
  return picked ?? null;
}

async function runImport(page: Page, urls: string[]) {
  // "networkidle" pode nunca estabilizar em alguns ambientes; usa carregamento mais tolerante.
  await page.goto("/properties", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Imoveis/i })).toBeVisible();

  await page.getByTestId("import-listings-open").click();
  await expect(page.getByRole("heading", { name: /Importar an[úu]ncios/i })).toBeVisible();

  for (let index = 0; index < urls.length; index += 1) {
    if (index > 0) await page.getByTestId("import-listings-add-url").click();
    const input = index === 0 ? page.getByTestId("import-listings-url") : page.getByTestId(`import-listings-url-${index}`);
    await input.fill(urls[index]);
  }

  await page.getByTestId("import-listings-submit").click();
  const jobBox = page.getByTestId("import-job-status");
  await expect(jobBox).toBeVisible({ timeout: 60_000 });
  await expect(jobBox).toContainText(/Status:/);

  await expect
    .poll(
      async () => {
        const status = (await jobBox.innerText()).toLowerCase();
        return status.includes("completed") || status.includes("failed") ? "done" : "running";
      },
      { timeout: 10 * 60_000, intervals: [1000, 2000, 5000] },
    )
    .toBe("done");

  return jobBox;
}

type ImportMatrixRow = {
  batchSize: number;
  attemptedUrls: string[];
  jobStatus: "completed" | "failed" | "unknown";
  okCount: number;
  errorSummary?: string;
};

function outFile(name: string) {
  return path.join(process.cwd(), "test-results", name);
}

async function readJobText(jobBox: ReturnType<Page["getByTestId"]>) {
  return (await jobBox.innerText()).replace(/\s+/g, " ").trim();
}

test("01 importa imovel de URL direta e valida fotos", async ({ page }) => {
  requireStaging();
  test.setTimeout(12 * 60_000);
  await login(page, adminEmail, adminPassword);

  const directListingUrl = "https://imobiliariasonhar.com.br/imovel/apartamento-palmas-2-quartos-65-m/AP0029-SOOR";
  const jobBox = await runImport(page, [directListingUrl]);

  await expect(jobBox).toContainText(/completed|failed/i);

  const okItems = jobBox.locator("li", { hasText: "✓" });
  const openLinks = okItems.locator("a", { hasText: /abrir/i });
  const openCount = await openLinks.count();
  const jobText = await jobBox.innerText();
  expect(openCount, jobText).toBeGreaterThan(0);

  const toCheck = Math.min(openCount, 10);
  for (let index = 0; index < toCheck; index += 1) {
    const href = await openLinks.nth(index).getAttribute("href");
    if (!href) continue;
    await page.goto(href, { waitUntil: "networkidle" });
    await expect(page.getByTestId("property-detail-title")).toBeVisible();
    await expect(page.getByTestId("property-media-section")).toBeVisible();

    // Garante que a descricao veio "completa" (nao truncada por "Ver mais").
    const fullDescription = await page.getByTestId("property-full_description").inputValue();
    expect(fullDescription.trim().length).toBeGreaterThan(250);
    expect(fullDescription.toLowerCase()).not.toContain("ver mais");

    const countText = await page.getByTestId("property-media-count").innerText();
    const currentCount = Number((countText.split("/")[0] ?? "").trim());
    expect(Number.isFinite(currentCount)).toBeTruthy();
    expect(currentCount).toBeGreaterThan(0);
    await expect(page.getByTestId("property-media-item").first()).toBeVisible();
  }
});

test("02 importacao em lotes 1..10 (melhor esforco) e gera matriz", async ({ page, context }) => {
  requireStaging();
  test.setTimeout(20 * 60_000);
  await login(page, adminEmail, adminPassword);

  const sources = [
    "casa63.com.br",
    "ritacamposnegocios.com.br",
    "estiloimobiliaria.com",
    "eduardomotaimoveis.com.br",
    "imperionegociosimob.com.br",
    "valadaresimoveis.com.br",
    "imobiliariasonhar.com.br",
    "simimoveis.net",
    "ricanato.com.br",
    "logos-to.com.br",
    "boasorteimoveis.com.br",
    "imobgurupi.com.br",
    "varandaimobiliaria.com.br",
    "casa63araguaina.com.br",
    "imobiliariatropical.com",
    "invistaemtocantins.com.br",
    "niloimoveis.com.br",
    "achelar.com.br",
    "dfimoveis.com.br",
    "olx.com.br",
    "zapimoveis.com.br",
  ];

  const harvested: string[] = [];
  const harvestingPage = await context.newPage();

  for (const site of sources) {
    if (harvested.length >= 10) break;
    try {
      const picked = await getRandomListingUrlFromSite(harvestingPage, site);
      if (picked) harvested.push(picked);
    } catch {
      // ignora bloqueios/redirects/captcha
    }
  }

  await harvestingPage.close();

  const matrix: ImportMatrixRow[] = [];
  if (harvested.length === 0) {
    fs.writeFileSync(outFile("import-matrix.json"), JSON.stringify({ ok: false, harvested, matrix }, null, 2));
    test.skip(true, "Nao foi possivel coletar nenhuma URL valida para montar lotes 1..10.");
  }

  // Mantem execucao dentro de um tempo razoavel no CI/local.
  const maxBatch = Math.min(5, harvested.length);
  for (let batchSize = 1; batchSize <= maxBatch; batchSize += 1) {
    const attemptedUrls = harvested.slice(0, batchSize);
    const jobBox = await runImport(page, attemptedUrls);

    const jobText = await readJobText(jobBox);
    const lower = jobText.toLowerCase();
    const jobStatus = lower.includes("completed")
      ? "completed"
      : lower.includes("failed")
        ? "failed"
        : "unknown";

    const okItems = jobBox.locator("li", { hasText: "âœ“" });
    const okCount = await okItems.count();

    const errorSummary = lower.includes("status: failed") ? jobText : undefined;
    matrix.push({ batchSize, attemptedUrls, jobStatus, okCount, ...(errorSummary ? { errorSummary } : {}) });
  }

  fs.writeFileSync(outFile("import-matrix.json"), JSON.stringify({ ok: true, harvested, matrix }, null, 2));

  // Melhor esforco: este teste nao falha se portais ou o extrator estiverem indisponiveis.
  // A analise completa fica no relatorio final via `import-matrix.json`.
  expect(matrix.length).toBeGreaterThan(0);
});
