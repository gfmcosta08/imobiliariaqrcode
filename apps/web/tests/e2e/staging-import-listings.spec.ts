import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

import { getGoldenFixtures } from "@imobiliariaqrcode/property-importer";

import {
  CURATED_LISTING_URLS,
  looksLikeDirectListingUrl,
  normalizeSiteHost,
  REQUIRED_IMPORT_SITES,
  type RequiredImportSite,
} from "./fixtures/import-site-urls";

const baseURL = process.env.STAGING_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? "";
const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "";
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? "";
const writeEnabled = process.env.E2E_STAGING_WRITE === "1";
const maxBatchEnv = Number(process.env.IMPORT_MATRIX_MAX_BATCH ?? "10");
const IMPORT_MATRIX_MAX_BATCH =
  Number.isFinite(maxBatchEnv) && maxBatchEnv >= 1 ? Math.min(10, maxBatchEnv) : 10;
const importMaxBatch = IMPORT_MATRIX_MAX_BATCH;

test.describe.configure({ mode: "serial" });

function skipUnlessStaging() {
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

async function harvestDirectListingUrls(
  page: Page,
  site: RequiredImportSite,
  max: number,
): Promise<string[]> {
  const found = new Set<string>();
  const curated = CURATED_LISTING_URLS[site];
  if (curated) found.add(curated);

  if (found.size >= max) return [...found].slice(0, max);

  const entry = `https://www.${normalizeSiteHost(site)}/imoveis`;
  try {
    await page.goto(entry, { waitUntil: "domcontentloaded", timeout: 45_000 });
    const hrefs = (await page.locator("a[href]").evaluateAll((nodes) =>
      nodes
        .map((n) => (n instanceof HTMLAnchorElement ? n.getAttribute("href") : null))
        .filter((h): h is string => Boolean(h))
        .slice(0, 1200),
    )) as string[];

    for (const href of hrefs) {
      if (found.size >= max) break;
      try {
        const abs = new URL(href, entry).toString();
        if (looksLikeDirectListingUrl(abs, site)) found.add(abs);
      } catch {
        // ignore invalid href
      }
    }
  } catch {
    // WAF/captcha/timeout — segue com URL curada se houver
  }

  return [...found].slice(0, max);
}

async function runImport(page: Page, urls: string[], pollTimeoutMs = 6 * 60_000) {
  await page.goto("/properties", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Imoveis/i })).toBeVisible();

  await page.getByTestId("import-listings-open").click();
  await expect(page.getByRole("heading", { name: /Importar an[úu]ncios/i })).toBeVisible();

  for (let index = 0; index < urls.length; index += 1) {
    if (index > 0) await page.getByTestId("import-listings-add-url").click();
    const input =
      index === 0
        ? page.getByTestId("import-listings-url")
        : page.getByTestId(`import-listings-url-${index}`);
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
      { timeout: pollTimeoutMs, intervals: [1000, 2000, 5000] },
    )
    .toBe("done");

  return jobBox;
}

async function closeImportDialog(page: Page) {
  const closeBtn = page.getByRole("button", { name: /^Fechar$/i });
  if (await closeBtn.isVisible()) {
    await closeBtn.click();
  }
}

type BatchResult = {
  batchSize: number;
  attemptedUrls: string[];
  jobStatus: "completed" | "failed" | "timeout" | "unknown";
  okCount: number;
  errorSummary?: string;
};

type SiteMatrixRow = {
  site: RequiredImportSite;
  directUrls: string[];
  batches: BatchResult[];
  status: "OK" | "Parcial" | "Falhou" | "Não Testável";
  photosImported: number;
  notes: string;
};

function outFile(name: string) {
  const dir = path.join(process.cwd(), "qa-output");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, name);
}

function countOkItems(jobBox: ReturnType<Page["getByTestId"]>) {
  return jobBox.locator("li").filter({ hasText: /✓|abrir/i });
}

test("01 importa imovel de URL direta e valida fotos", async ({ page }) => {
  skipUnlessStaging();
  test.setTimeout(12 * 60_000);
  await login(page, adminEmail, adminPassword);

  const sonharFixtures = getGoldenFixtures("imobiliariasonhar");
  const directListingUrl =
    sonharFixtures[0]?.listingUrl ??
    "https://imobiliariasonhar.com.br/imovel/apartamento-palmas-2-quartos-65-m/AP0029-SOOR";
  const minDescriptionLength = sonharFixtures[0]?.minDescriptionLength ?? 250;
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
    await page.goto(href, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("property-detail-title")).toBeVisible();
    await expect(page.getByTestId("property-media-section")).toBeVisible();

    const fullDescription = await page.getByTestId("property-full_description").inputValue();
    expect(fullDescription.trim().length).toBeGreaterThan(minDescriptionLength);
    expect(fullDescription.toLowerCase()).not.toContain("ver mais");

    const countText = await page.getByTestId("property-media-count").innerText();
    const currentCount = Number((countText.split("/")[0] ?? "").trim());
    expect(Number.isFinite(currentCount)).toBeTruthy();
    expect(currentCount).toBeGreaterThan(0);
    await expect(page.getByTestId("property-media-item").first()).toBeVisible();
  }

  await closeImportDialog(page);
});

test("02 matriz por site (21 portais, lotes 1..N URLs diretas)", async ({
  page,
  context,
}, testInfo) => {
  skipUnlessStaging();
  test.setTimeout(4 * 60 * 60_000);
  await login(page, adminEmail, adminPassword);

  const harvestPage = await context.newPage();
  const siteMatrix: SiteMatrixRow[] = [];

  for (const site of REQUIRED_IMPORT_SITES) {
    const directUrls = await harvestDirectListingUrls(harvestPage, site, 10);
    const batches: BatchResult[] = [];
    let totalPhotos = 0;
    let notes = directUrls.length === 0 ? "Sem URL direta coletada" : "";

    if (directUrls.length === 0) {
      siteMatrix.push({
        site,
        directUrls: [],
        batches: [],
        status: "Não Testável",
        photosImported: 0,
        notes,
      });
      continue;
    }

    const maxBatch = Math.min(importMaxBatch, 10, directUrls.length);
    for (let batchSize = 1; batchSize <= maxBatch; batchSize += 1) {
      const attemptedUrls = directUrls.slice(0, batchSize);
      try {
        const jobBox = await runImport(page, attemptedUrls, 6 * 60_000);
        const jobText = (await jobBox.innerText()).replace(/\s+/g, " ").trim();
        const lower = jobText.toLowerCase();
        const jobStatus = lower.includes("completed")
          ? "completed"
          : lower.includes("failed")
            ? "failed"
            : "unknown";

        const okLocator = countOkItems(jobBox);
        const okCount = await okLocator.count();
        if (okCount > 0) {
          const firstLine = await okLocator.first().innerText();
          const photoMatch = /(\d+)\s+foto/i.exec(firstLine);
          if (photoMatch) totalPhotos = Math.max(totalPhotos, Number(photoMatch[1]));
        }

        batches.push({
          batchSize,
          attemptedUrls,
          jobStatus,
          okCount,
          ...(lower.includes("status: failed") ? { errorSummary: jobText.slice(0, 400) } : {}),
        });
        await closeImportDialog(page);
      } catch {
        batches.push({
          batchSize,
          attemptedUrls,
          jobStatus: "timeout",
          okCount: 0,
          errorSummary: "timeout_aguardando_job",
        });
        notes = notes || "timeout em lote";
        await closeImportDialog(page).catch(() => undefined);
        break;
      }
    }

    const anyOk = batches.some((b) => b.okCount > 0);
    const allFailed = batches.length > 0 && batches.every((b) => b.okCount === 0);
    const status: SiteMatrixRow["status"] = !anyOk
      ? allFailed
        ? "Falhou"
        : "Não Testável"
      : batches.length < 10
        ? "Parcial"
        : "OK";

    siteMatrix.push({
      site,
      directUrls,
      batches,
      status,
      photosImported: totalPhotos,
      notes:
        notes ||
        (directUrls.length < 10 ? `Lotes 1..${directUrls.length} (URLs distintas limitadas)` : ""),
    });
  }

  await harvestPage.close();

  const matrixPath = testInfo.outputPath("import-site-matrix.json");
  const publicMatrixPath = outFile("import-site-matrix.json");
  fs.mkdirSync(path.dirname(publicMatrixPath), { recursive: true });
  const payload = JSON.stringify(
    { ok: true, generatedAt: new Date().toISOString(), sites: siteMatrix },
    null,
    2,
  );
  fs.writeFileSync(matrixPath, payload);
  fs.writeFileSync(publicMatrixPath, payload);

  const tested = siteMatrix.filter((s) => s.batches.length > 0).length;
  expect(tested).toBeGreaterThan(0);
  expect(siteMatrix.length).toBe(REQUIRED_IMPORT_SITES.length);
});
