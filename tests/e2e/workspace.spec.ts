import { expect, test } from "@playwright/test";

test("shows the public landing page before authentication", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Make every API make sense/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Start building/ })).toBeVisible();
  await expect(page.locator(".landing-footer")).toBeVisible();
  await expect(page.locator(".sidebar")).toHaveCount(0);
  await expect(page.locator(".mobile-nav")).toHaveCount(0);
  await expect(page.locator(".landing-copy")).toHaveCSS("animation-name", "landing-rise");
});


test("landing page scrolls vertically on mobile without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const dimensions = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: window.innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.clientHeight);
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
});

test("collection icon folder responds to click and keyboard input", async ({ page }) => {
  await page.goto("/");
  const folder = page.getByRole("button", { name: "Toggle collection icon folder" });
  await folder.click();
  await expect(folder).toHaveAttribute("aria-expanded", "true");
  await folder.press("Space");
  await expect(folder).toHaveAttribute("aria-expanded", "false");
});

test("direct workspace routes return signed-out visitors to the landing page", async ({ page }) => {
  await page.goto("/collections");
  await expect(page.getByRole("heading", { name: /Make every API make sense/ })).toBeVisible();
  await expect(page.locator(".app")).toHaveCount(0);
  await expect(page.locator(".mobile-nav")).toHaveCount(0);
});

test("account entry opens the sign-in and registration dialog", async ({ page }) => {
  await page.goto("/");
  await page.locator(".landing-header-cta").click();
  await expect(page.getByRole("dialog")).toContainText("Create your DevLens account");
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await page.getByRole("button", { name: /Already have an account/ }).click();
  await expect(page.getByRole("dialog")).toContainText("Welcome back");
});

test("password recovery is available from sign in", async ({ page }) => {
  await page.goto("/");
  await page.locator(".landing-signin").click();
  await page.getByRole("button", { name: "Forgot your password?" }).click();
  await expect(page.getByRole("dialog")).toContainText("Reset your password");
  await expect(page.getByRole("button", { name: "Send reset link" })).toBeVisible();
});

test("landing motion respects reduced-motion preferences", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Make every API make sense/ })).toBeVisible();
  const duration = await page.locator(".landing-copy").evaluate(el => getComputedStyle(el).animationDuration);
  expect(parseFloat(duration)).toBeLessThan(0.001);
});

test("landing page exposes a keyboard skip link", async ({ page }) => {
  await page.goto("/");
  const link = page.getByRole("link", { name: "Skip to content" });
  await link.focus();
  await expect(link).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator("#landing-main")).toBeFocused();
});

test("modal traps keyboard focus and restores it on close", async ({ page }) => {
  await page.goto("/");
  const trigger = page.locator(".landing-header-cta");
  await trigger.click();
  const dialog = page.getByRole("dialog");
  const close = dialog.getByRole("button", { name: "Close" });
  await expect(close).toBeFocused();
  const lastAction = dialog.getByRole("button", { name: /New to DevLens/ });
  await lastAction.focus();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await close.click();
  await expect(trigger).toBeFocused();
});

test("password recovery link opens the password update form", async ({ page }) => {
  await page.goto("/?password-reset=1");
  await expect(page.getByRole("dialog")).toContainText("Choose a new password");
  await expect(page.getByLabel("New password")).toBeVisible();
  await expect(page.getByLabel("Confirm new password")).toBeVisible();
});

test.describe("authenticated workspace", () => {
  test.skip(!process.env.DEVLENS_E2E_EMAIL || !process.env.DEVLENS_E2E_PASSWORD, "Set DEVLENS_E2E_EMAIL and DEVLENS_E2E_PASSWORD to run account-backed workspace tests.");
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Sign in", exact: true }).first().click();
    await page.getByLabel("Email address").fill(process.env.DEVLENS_E2E_EMAIL || "");
    await page.getByLabel("Password").fill(process.env.DEVLENS_E2E_PASSWORD || "");
    await page.getByRole("button", { name: "Sign in", exact: true }).last().click();
    await expect(page.locator(".app")).toBeVisible();
  });
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
  await page.reload();
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
  await page.reload();
  await expect(page.locator(".screen-card-grid")).toContainText("Staging");
});

test("imports and exports a DevLens collection", async ({ page }) => {
  await page.goto("/");
  const importedName = `Imported API ${Date.now()}`;
  const collection = {
    format: "devlens-collection",
    version: 1,
    name: importedName,
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
  await expect(page.locator(".collection-list")).toContainText(importedName);
  await page.getByRole("button", { name: /Collections/ }).first().click();
  const importedCard = page.locator(`.screen-card:has(h3:text-is("${importedName}"))`);
  await expect(importedCard).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await importedCard.getByRole("button", { name: "Export", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain(importedName.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
  page.once("dialog", dialog => dialog.accept());
  await importedCard.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(importedCard).toHaveCount(0);
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
  const renamedName = `Renamed API ${Date.now()}`;
  await page.getByRole("button", { name: "New collection" }).first().click();
  await page.getByPlaceholder("Collection name").fill(`Portfolio API ${Date.now()}`);
  await page.getByRole("button", { name: "Create collection" }).click();
  page.once("dialog", dialog => dialog.accept(renamedName));
  await page.getByRole("button", { name: "Rename", exact: true }).first().click();
  const renamedCard = page.locator(`.screen-card:has(h3:text-is("${renamedName}"))`);
  await expect(renamedCard).toBeVisible();
  await renamedCard.getByRole("button", { name: "Duplicate", exact: true }).click();
  await expect(page.locator(".import-banner")).toContainText("Collection duplicated.", { timeout: 20_000 });
  const copyName = `${renamedName} copy`;
  await expect(page.locator(".collection-list")).toContainText(copyName, { timeout: 15_000 });
  const copyAction = page.getByRole("button", { name: `Delete ${copyName}`, exact: true });
  await expect(copyAction).toBeVisible();
  page.once("dialog", dialog => dialog.accept());
  await copyAction.click();
  await expect(page.locator(".collection-list")).not.toContainText(copyName);
  page.once("dialog", dialog => dialog.accept());
  await renamedCard.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(renamedCard).toHaveCount(0);
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

test("selects files for multipart form-data requests", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Body" }).click();
  await page.locator("#body-type").selectOption("formdata");
  await page.getByLabel("File field name").fill("avatar");
  await page.getByLabel("Upload files").setInputFiles({ name: "avatar.txt", mimeType: "text/plain", buffer: Buffer.from("sample upload") });
  await expect(page.locator(".formdata-file")).toContainText("avatar.txt");
  await expect(page.locator(".formdata-file")).toContainText("avatar");
  await page.getByRole("button", { name: "Remove file avatar.txt" }).click();
  await expect(page.locator(".formdata-file")).toHaveCount(0);
});

test("sends a request through the authenticated secure egress gateway", async ({ page }) => {
  test.skip(!process.env.PLAYWRIGHT_BASE_URL, "Runs against production after the Cloudflare deployment.");
  await page.goto("/");
  await page.locator(".url-row .send-button").click();
  await expect(page.locator(".response-stats .status-good")).toContainText("200", { timeout: 30_000 });
  await expect(page.locator(".response-head")).toContainText("Latest request result");
});


test("sign out returns the user to the public landing page", async ({ page }) => {
  await page.getByRole("button", { name: "Open main menu" }).click();
  await page.getByRole("button", { name: /Sign out/ }).click();
  await expect(page.getByRole("heading", { name: /Make every API make sense/ })).toBeVisible();
});

test("keyboard users can skip directly to the workspace", async ({ page }) => {
  const link = page.getByRole("link", { name: "Skip to workspace" });
  await expect(link).toBeAttached();
  await link.focus();
  await expect(link).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator("#request-workspace")).toBeFocused();
});

test("workspace remains usable without horizontal overflow at release widths", async ({ page }) => {
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth
    }));
    expect(dimensions.content, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(dimensions.viewport);
  }
});

test("response inspector supports pretty, raw, headers and JSON download", async ({ page }) => {
  const url = `https://api.example.test/inspector-${Date.now()}`;
  await page.route("**/api/proxy", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      status: 200, statusText: "OK", duration: 18, size: 22,
      headers: { "content-type": "application/json", "x-devlens-check": "passed" },
      body: '{"ok":true,"count":2}'
    })
  }));
  await page.getByLabel("Request URL").fill(url);
  await page.locator(".url-row .send-button").click();
  await expect(page.locator(".response-code")).toContainText('"ok": true');
  await page.getByRole("button", { name: "Raw", exact: true }).click();
  await expect(page.locator(".response-code")).toHaveText('{"ok":true,"count":2}');
  await page.getByRole("button", { name: "Headers", exact: true }).click();
  await expect(page.locator(".response-code")).toContainText('"x-devlens-check": "passed"');
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("devlens-response.json");
  await page.getByRole("button", { name: "History" }).click();
  await expect(page.locator(".history-table")).toContainText(url);
  await page.reload();
  await page.getByRole("button", { name: "History" }).click();
  await expect(page.locator(".history-table")).toContainText(url);
});

test("response inspector formats XML and downloads it with an XML extension", async ({ page }) => {
  await page.route("**/api/proxy", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      status: 200, statusText: "OK", duration: 9, size: 31,
      headers: { "content-type": "application/xml" },
      body: "<root><item>DevLens</item></root>"
    })
  }));
  await page.locator(".url-row .send-button").click();
  await expect(page.locator(".response-code")).toContainText("<item>DevLens</item>");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("devlens-response.xml");
});

test("request cancellation aborts the in-flight request", async ({ page }) => {
  await page.route("**/api/proxy", async route => {
    await new Promise(resolve => setTimeout(resolve, 1800));
    try {
      await route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ status: 200, statusText: "OK", duration: 1, size: 2, headers: {}, body: "ok" })
      });
    } catch { /* The browser cancelled this request. */ }
  });
  await page.locator(".url-row .send-button").click();
  await page.getByRole("button", { name: /Cancel/ }).click();
  await expect(page.getByRole("alert")).toContainText("Request cancelled.");
});

test("request validation rejects an invalid URL before calling the gateway", async ({ page }) => {
  let gatewayCalls = 0;
  await page.route("**/api/proxy", route => {
    gatewayCalls += 1;
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.getByLabel("Request URL").fill("not a valid URL");
  await page.locator(".url-row .send-button").click();
  await expect(page.getByRole("alert")).toContainText("Invalid URL");
  expect(gatewayCalls).toBe(0);
});

test("publishes, opens, imports and unpublishes a public collection", async ({ page }) => {
  const name = `Share flow ${Date.now()}`;
  await page.goto("/collections");
  await page.getByRole("button", { name: "New collection" }).first().click();
  await page.getByPlaceholder("Collection name").fill(name);
  await page.getByRole("button", { name: "Create collection" }).click();
  const originalCard = page.locator(".screen-card").filter({ has: page.getByRole("heading", { name, exact: true }) });
  await expect(originalCard).toBeVisible();
  await originalCard.getByRole("button", { name: "Open workspace" }).click();
  await page.getByTitle("Save request to this device").click();
  await page.getByRole("button", { name: "Collections" }).first().click();
  await originalCard.getByRole("button", { name: "Share", exact: true }).click();
  await expect(page.locator(".import-banner")).toContainText(/Public link copied|Copy your public collection link/, { timeout: 20_000 });
  const notice = await page.locator(".import-banner").innerText();
  const shareUrl = notice.match(/https:\/\/[^\s]+/)?.[0];
  expect(shareUrl).toBeTruthy();

  const sharedPage = await page.context().newPage();
  await sharedPage.goto(shareUrl!);
  await expect(sharedPage.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(sharedPage.locator(".shared-request-list")).toContainText("Untitled request");
  await sharedPage.getByRole("button", { name: "Import to workspace" }).click();
  await expect(sharedPage).toHaveURL(url => url.pathname === "/");
  await sharedPage.goto("/collections");
  const importedName = name + " (imported)";
  const importedCard = sharedPage.locator(".screen-card").filter({ has: sharedPage.getByRole("heading", { name: importedName, exact: true }) });
  await expect(importedCard).toBeVisible();

  await page.getByRole("button", { name: "DevLens home" }).click();
  const unpublish = page.getByRole("button", { name: "Unpublish " + name });
  await expect(unpublish).toBeVisible();
  page.once("dialog", dialog => dialog.accept());
  await unpublish.click();
  await expect(page.locator(".import-banner")).toContainText("no longer public");
  await sharedPage.goto(shareUrl!);
  await expect(sharedPage.locator(".shared-error")).toContainText("does not exist or is no longer public");

  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Collections" }).first().click();
  const cleanupOriginal = page.locator(".screen-card").filter({ has: page.getByRole("heading", { name, exact: true }) });
  if (await cleanupOriginal.count()) await cleanupOriginal.getByRole("button", { name: "Delete", exact: true }).click();
  await sharedPage.goto("/collections");
  const cleanupImported = sharedPage.locator(".screen-card").filter({ has: sharedPage.getByRole("heading", { name: importedName, exact: true }) });
  if (await cleanupImported.count()) {
    sharedPage.once("dialog", dialog => dialog.accept());
    await cleanupImported.getByRole("button", { name: "Delete", exact: true }).click();
  }
  await sharedPage.close();
});

});
