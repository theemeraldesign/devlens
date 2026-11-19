import { expect, test } from "@playwright/test";

test("opens the request studio and creates a local collection", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Request studio." })).toBeVisible();
  await expect(page.getByLabel("Request URL")).toHaveValue("https://jsonplaceholder.typicode.com/posts/1");
  await page.getByRole("button", { name: "Collections" }).first().click();
  await expect(page).toHaveURL(url => url.pathname === "/collections");
  await page.getByRole("button", { name: "New collection" }).first().click();
  await page.getByPlaceholder("Collection name").fill("Portfolio API");
  await page.getByRole("button", { name: "Create collection" }).click();
  await expect(page.locator(".screen-card-grid")).toContainText("Portfolio API");
});

test("switches between dark and light themes", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".app")).toHaveClass(/dark/);
  await page.getByTitle("Toggle theme").click();
  await expect(page.locator(".app")).toHaveClass(/light/);
});

test("opens the JSON formatter utility", async ({ page }) => {
  await page.goto("/tools");
  await page.getByRole("button", { name: "JSON formatter" }).click();
  await page.locator(".utility-input").fill('{"ok":true,"count":2}');
  await page.getByRole("button", { name: /run utility/i }).click();
  await expect(page.locator(".utility-output")).toContainText('"ok": true');
});

test("creates a private environment from mobile navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Environments" }).click();
  await page.getByRole("button", { name: "New environment" }).first().click();
  await page.getByPlaceholder("Development").fill("Staging");
  await page.getByPlaceholder("API_BASE_URL").fill("BASE_URL");
  await page.getByPlaceholder("Variable value").fill("https://staging.example.test");
  await page.getByRole("button", { name: "Save environment" }).click();
  await expect(page.locator(".screen-card-grid")).toContainText("Staging");
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

test("imports a cURL command into the request editor", async ({ page }) => {
  await page.goto("/tools");
  await page.getByRole("button", { name: "cURL importer" }).click();
  await page.locator(".utility-input").fill("curl -X POST 'https://api.example.com/items' -H 'Content-Type: application/json' -d '{\"name\":\"DevLens\"}'");
  await page.getByRole("button", { name: /run utility/i }).click();
  await page.getByRole("button", { name: "Load into request editor" }).click();
  await expect(page.getByLabel("HTTP method")).toHaveValue("POST");
  await expect(page.getByLabel("Request URL")).toHaveValue("https://api.example.com/items");
  await page.getByRole("button", { name: "Body" }).click();
  await expect(page.getByLabel("Request body")).toHaveValue('{"name":"DevLens"}');
});

test("renames, duplicates and deletes a collection", async ({ page }) => {
  await page.goto("/collections");
  await page.getByRole("button", { name: "New collection" }).first().click();
  await page.getByPlaceholder("Collection name").fill("Portfolio API");
  await page.getByRole("button", { name: "Create collection" }).click();
  page.once("dialog", dialog => dialog.accept("Renamed API"));
  await page.getByRole("button", { name: "Rename", exact: true }).first().click();
  await expect(page.locator(".screen-card-grid")).toContainText("Renamed API");
  const renamedCard = page.locator(".screen-card").filter({ hasText: "Renamed API" });
  await renamedCard.getByRole("button", { name: "Duplicate" }).click();
  await expect(page.locator(".screen-card-grid")).toContainText("Renamed API copy");
  page.once("dialog", dialog => dialog.accept());
  const copyCard = page.locator(".screen-card").filter({ hasText: "Renamed API copy" });
  await copyCard.getByRole("button", { name: "Delete" }).click();
  await expect(page.locator(".screen-card-grid")).not.toContainText("Renamed API copy");
});

test("edits multipart form-data fields in the request builder", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Body" }).click();
  await page.locator("#body-type").selectOption("formdata");
  await page.getByRole("button", { name: "Add field" }).click();
  await page.getByLabel("Form data key 1").fill("name");
  await page.getByLabel("Form data value 1").fill("DevLens");
  await page.getByRole("button", { name: "Add field" }).click();
  await page.getByLabel("Form data key 2").fill("status");
  await page.getByLabel("Form data value 2").fill("building");
  await expect(page.getByLabel("Form data value 1")).toHaveValue("DevLens");
  await expect(page.getByLabel("Form data value 2")).toHaveValue("building");
  await page.getByRole("button", { name: "Remove form data field 1" }).click();
  await expect(page.getByLabel("Form data key 1")).toHaveValue("status");
});

test("uses separate responsive screens and a visible brand on Android", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await expect(page.locator(".top-brand")).toBeVisible();
  await expect(page.getByLabel("Request URL")).toBeVisible();
  await expect(page.getByRole("button", { name: "Workspace" })).toBeVisible();
  await page.getByRole("button", { name: "Collections" }).first().click();
  await expect(page).toHaveURL(url => url.pathname === "/collections");
  await expect(page.getByRole("heading", { name: "Request collections", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Environments" }).click();
  await expect(page).toHaveURL(url => url.pathname === "/environments");
  await expect(page.getByRole("heading", { name: "Environments", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "New environment" }).first()).toBeVisible();
  await page.getByRole("button", { name: "History" }).click();
  await expect(page).toHaveURL(url => url.pathname === "/history");
  await expect(page.getByRole("heading", { name: "Request history", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Tools" }).click();
  await expect(page).toHaveURL(url => url.pathname === "/tools");
  await expect(page.getByRole("button", { name: "JSON formatter" })).toBeVisible();
  const widths = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, page: document.documentElement.scrollWidth }));
  expect(widths.page).toBeLessThanOrEqual(widths.viewport);
});
