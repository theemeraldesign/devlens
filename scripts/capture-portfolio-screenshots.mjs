import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "https://devlens.cc.cd";
const email = process.env.DEVLENS_E2E_EMAIL;
const password = process.env.DEVLENS_E2E_PASSWORD;
if (!email || !password) throw new Error("Production screenshot capture requires the dedicated E2E account.");

const output = "docs/screenshots";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const screenshot = async name => page.screenshot({ path: `${output}/${name}.png`, fullPage: false, animations: "disabled" });
const maskAccount = async target => {
  await target.addStyleTag({ content: ".profile-row span{filter:blur(8px)!important}.profile-row small{visibility:hidden!important}" });
};

try {
  await page.goto(baseURL, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /Make every API make sense/ }).waitFor();
  await screenshot("landing-desktop");

  await page.locator(".landing-signin").click();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).last().click();
  await page.locator(".app").waitFor({ state: "visible", timeout: 30000 });
  await page.getByRole("heading", { name: "Request studio." }).waitFor();
  await maskAccount(page);

  await page.route("**/api/proxy", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      status: 200, statusText: "OK", duration: 42, size: 126,
      headers: { "content-type": "application/json", "x-powered-by": "DevLens demo" },
      body: JSON.stringify({ data: [{ id: 1, name: "Ada Lovelace", role: "Engineer" }, { id: 2, name: "Grace Hopper", role: "Computer scientist" }], total: 2 }, null, 2)
    })
  }));
  await page.locator(".url-row .send-button").click();
  await page.locator(".response-stats .status-good").waitFor({ timeout: 15000 });
  await screenshot("workspace-desktop");
  await screenshot("response-inspector");

  await page.setViewportSize({ width: 390, height: 844 });
  await screenshot("workspace-mobile");
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto(baseURL + "/collections", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "New collection" }).first().click();
  await page.getByPlaceholder("Collection name").fill("DevLens Demo API");
  await page.getByRole("button", { name: "Create collection" }).click();
  const collection = page.locator(".screen-card").filter({ has: page.getByRole("heading", { name: "DevLens Demo API", exact: true }) });
  await collection.waitFor({ state: "visible" });
  await collection.getByRole("button", { name: "Open workspace" }).click();
  await page.getByTitle("Save request to this device").click();
  await page.getByRole("button", { name: "Collections" }).first().click();
  await collection.waitFor({ state: "visible" });
  await screenshot("collections-desktop");

  const publishResponse = page.waitForResponse(response => {
    if (!response.url().includes("/functions/v1/publish-collection")) return false;
    try { return JSON.parse(response.request().postData() || "{}").action === "publish"; } catch { return false; }
  });
  await collection.getByRole("button", { name: "Share", exact: true }).click();
  const publish = await publishResponse;
  if (!publish.ok()) throw new Error("Unable to publish the demo collection for the portfolio screenshot.");
  const { slug } = await publish.json();
  if (!slug) throw new Error("The publish action did not return a public slug.");
  const shared = await context.newPage();
  await shared.goto(new URL("/share/" + slug, baseURL).toString(), { waitUntil: "networkidle" });
  await shared.getByRole("heading", { name: "DevLens Demo API", exact: true }).waitFor();
  await shared.screenshot({ path: `${output}/shared-collection.png`, fullPage: false, animations: "disabled" });
  await shared.close();

  await page.goto(baseURL + "/environments", { waitUntil: "networkidle" });
  await maskAccount(page);
  await page.getByRole("button", { name: "New environment" }).first().click();
  await page.getByPlaceholder("Development").fill("Demo environment");
  await page.getByPlaceholder("API_BASE_URL").fill("API_BASE_URL");
  await page.getByPlaceholder("Variable value").fill("https://api.example.test");
  await page.getByRole("button", { name: "Save environment" }).click();
  await page.getByRole("heading", { name: "Environments", exact: true }).waitFor();
  await screenshot("environments-desktop");

  await page.goto(baseURL + "/history", { waitUntil: "networkidle" });
  await maskAccount(page);
  await page.getByRole("heading", { name: "Request history", exact: true }).waitFor();
  await screenshot("history-desktop");

  await page.goto(baseURL + "/tools", { waitUntil: "networkidle" });
  await maskAccount(page);
  await page.getByRole("button", { name: "JSON formatter" }).click();
  await page.locator(".utility-input").fill('{"project":"DevLens","status":"live","secure":true}');
  await page.getByRole("button", { name: /run utility/i }).click();
  await page.locator(".utility-output").waitFor({ state: "visible" });
  await screenshot("utilities");
  console.log("Captured production portfolio screenshots:", [
    "landing-desktop", "workspace-desktop", "workspace-mobile", "collections-desktop",
    "environments-desktop", "response-inspector", "shared-collection", "history-desktop", "utilities"
  ].join(", "));
} finally {
  await browser.close();
}
