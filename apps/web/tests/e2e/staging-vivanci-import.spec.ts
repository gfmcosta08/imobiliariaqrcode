import { expect, test } from "@playwright/test";

const baseURL = process.env.STAGING_BASE_URL ?? "";
const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "";
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? "";

test("vivanci importa todas as fotos via Supabase direto", async ({ page }) => {
  test.skip(!baseURL, "STAGING_BASE_URL required");
  test.skip(!adminEmail || !adminPassword, "E2E creds required");
  test.setTimeout(8 * 60_000);

  await page.goto("/login");
  await page.getByTestId("login-identifier").fill(adminEmail);
  await page.getByTestId("login-password").fill(adminPassword);
  await page.getByTestId("login-submit").click();
  await page.waitForURL(/\/(dashboard|admin|properties)/, { timeout: 45_000 });

  await page.goto("/properties", { waitUntil: "domcontentloaded" });
  await page.getByTestId("import-listings-open").click();
  await page.getByTestId("import-listings-url").fill("https://vivanci.com/imovel/0826");
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

  const okLine = jobBox.locator("li", { hasText: "✓" }).first();
  await expect(okLine).toBeVisible();
  const lineText = await okLine.innerText();
  expect(lineText).not.toContain("type_text/html");
  expect(lineText).not.toMatch(/imagens_parciais:\d+\/\d+/);

  const openLink = okLine.locator("a", { hasText: /abrir/i });
  const href = await openLink.getAttribute("href");
  expect(href).toBeTruthy();
  await page.goto(href!, { waitUntil: "domcontentloaded" });

  const countText = await page.getByTestId("property-media-count").innerText();
  const currentCount = Number((countText.split("/")[0] ?? "").trim());
  expect(currentCount).toBeGreaterThanOrEqual(5);

  const fullDescription = await page.getByTestId("property-full_description").inputValue();
  expect(fullDescription.trim().length).toBeGreaterThan(250);
});
