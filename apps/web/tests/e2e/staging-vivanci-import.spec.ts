import { expect, test } from "@playwright/test";

import { getGoldenFixtures, IMPORT_IMAGE_CAP } from "@imobiliariaqrcode/property-importer";

const baseURL = process.env.STAGING_BASE_URL ?? "";
const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "";
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? "";

async function loginAndImport(page: import("@playwright/test").Page, listingUrl: string) {
  await page.goto("/login");
  await page.getByTestId("login-identifier").fill(adminEmail);
  await page.getByTestId("login-password").fill(adminPassword);
  await page.getByTestId("login-submit").click();
  await page.waitForURL(/\/(dashboard|admin|properties)/, { timeout: 45_000 });

  await page.goto("/properties", { waitUntil: "domcontentloaded" });
  await page.getByTestId("import-listings-open").click();
  await page.getByTestId("import-listings-url").fill(listingUrl);
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

  const jobText = await jobBox.innerText();
  expect(jobText.toLowerCase()).toContain("completed");

  const okLine = jobBox.locator("li", { hasText: listingUrl.split("/").pop() }).first();
  const line = (await okLine.count()) > 0 ? okLine : jobBox.locator("li", { hasText: "✓" }).first();
  await expect(line).toBeVisible();
  const lineText = await line.innerText();
  expect(lineText).not.toContain("type_text/html");
  expect(lineText).not.toMatch(/imagens_parciais:\d+\/\d/);

  const openLink = line.locator("a", { hasText: /abrir/i });
  const href = await openLink.getAttribute("href");
  expect(href).toBeTruthy();
  await page.goto(href!, { waitUntil: "domcontentloaded" });

  const countText = await page.getByTestId("property-media-count").innerText();
  const currentCount = Number((countText.split("/")[0] ?? "").trim());

  const fullDescription = await page.getByTestId("property-full_description").inputValue();

  return { currentCount, fullDescription, lineText };
}

for (const fixture of getGoldenFixtures("vivanci")) {
  test(`vivanci ${fixture.listingUrl} (registry fixture)`, async ({ page }) => {
    test.skip(!baseURL, "STAGING_BASE_URL required");
    test.skip(!adminEmail || !adminPassword, "E2E creds required");
    test.setTimeout(8 * 60_000);

    const { currentCount, fullDescription, lineText } = await loginAndImport(
      page,
      fixture.listingUrl,
    );

    expect(currentCount).toBeGreaterThanOrEqual(fixture.minPhotos);
    if (fixture.minPhotos >= IMPORT_IMAGE_CAP) {
      expect(lineText).toMatch(new RegExp(`${IMPORT_IMAGE_CAP} foto\\(s\\)`));
      expect(currentCount).toBe(IMPORT_IMAGE_CAP);
    }
    expect(fullDescription.trim().length).toBeGreaterThanOrEqual(fixture.minDescriptionLength);
  });
}
