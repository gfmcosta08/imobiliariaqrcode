import { expect, test } from "@playwright/test";

test("homepage mobile mantém busca, filtros e cards utilizaveis", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Encontre seu lugar")).toBeVisible();
  await expect(page.getByTestId("home-hero-search")).toBeVisible();
  await page.getByTestId("home-hero-search").fill("Salvador");
  await page.getByTestId("home-hero-search-submit").click();
  await expect(page).toHaveURL(/q=Salvador/);
  await expect(page.getByTestId("home-filters-form")).toBeVisible();
  await page.getByTestId("home-filter-q").fill("Centro");
  await page.getByTestId("home-filter-purpose").selectOption("sale");
  await expect(page.getByTestId("home-filter-purpose")).toHaveValue("sale");
});
