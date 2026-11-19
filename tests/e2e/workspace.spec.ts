import { expect, test } from "@playwright/test";

test("opens the request studio and creates a local collection", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /request studio/i })).toBeVisible();
  await expect(page.getByLabel("Request URL")).toHaveValue("https://jsonplaceholder.typicode.com/posts/1");
  await page.getByRole("button", { name: /new collection/i }).click();
  await page.getByPlaceholder("Collection name").fill("Portfolio API");
  await page.getByRole("button", { name: "Create collection" }).click();
  await expect(page.locator(".workspace-switch")).toContainText("Portfolio API");
});

test("switches between dark and light themes", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".app")).toHaveClass(/dark/);
  await page.getByTitle("Toggle theme").click();
  await expect(page.locator(".app")).toHaveClass(/light/);
});
test("opens the JSON formatter utility", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Utilities" }).click();
  await page.getByRole("button", { name: "JSON formatter" }).click();
  await page.locator(".utility-input").fill('{"ok":true,"count":2}');
  await page.getByRole("button", { name: /run utility/i }).click();
  await expect(page.locator(".utility-output")).toContainText('"ok": true');
});

test("creates a private environment from mobile navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Environments" }).click();
  await page.getByRole("button", { name: /new environment/i }).click();
  await page.getByPlaceholder("Development").fill("Staging");
  await page.getByPlaceholder("API_BASE_URL").fill("BASE_URL");
  await page.getByPlaceholder("Variable value").fill("https://staging.example.test");
  await page.getByRole("button", { name: "Save environment" }).click();
  await expect(page.locator(".heading-meta")).toContainText("Staging");
});

test("imports and exports a DevLens collection", async ({ page }) => {
  await page.goto("/");
  const collection = {
    format: "devlens-collection",
    version: 1,
    name: "Imported API",
    requests: [{
      name: "List posts",
      method: "GET",
      url: "https://jsonplaceholder.typicode.com/posts",
      headers: [{ key: "Accept", value: "application/json", enabled: true }],
      body: ""
    }]
  };
  await page.locator(".collection-actions input").setInputFiles({
    name: "import.devlens.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(collection))
  });
  await expect(page.locator(".collection-list")).toContainText("Imported API");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export selected" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain("imported-api");
});
