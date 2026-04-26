import { createServer, type Server } from "node:http";
import { test, expect } from "@playwright/test";

import { prisma } from "../lib/db/prisma";

const IMAGE_UPSTREAM_PORT = Number.parseInt(process.env.PLAYWRIGHT_IMAGE_UPSTREAM_PORT ?? "45731", 10);
const IMAGE_ORIGIN = `http://127.0.0.1:${IMAGE_UPSTREAM_PORT}`;
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

let imageServer: Server;

const LONG_REMOTE_IMAGE_PATH = "/cache/https://coverartarchive.org/release/fc4ca5a7-ac12-4a30-92db-6c44c971349a/42537485144-1200.jpg";

async function resetDatabaseState(): Promise<void> {
  await prisma.auditLog.deleteMany();
  await prisma.request.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.appConfig.deleteMany();
}

test.beforeAll(async () => {
  imageServer = createServer((req, res) => {
    if (req.url === "/cover.png" || req.url === LONG_REMOTE_IMAGE_PATH) {
      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(PNG_1X1);
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not found");
  });

  await new Promise<void>((resolve, reject) => {
    imageServer.once("error", reject);
    imageServer.listen(IMAGE_UPSTREAM_PORT, "127.0.0.1", () => {
      imageServer.off("error", reject);
      resolve();
    });
  });
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    imageServer.close((error) => (error ? reject(error) : resolve()));
  });

  await prisma.$disconnect();
});

test.beforeEach(async () => {
  await resetDatabaseState();
});

test("returns a liveness response for container health checks", async ({ request }) => {
  const response = await request.get("/api/health/live");
  const payload = (await response.json()) as { status?: string };

  expect(response.status()).toBe(200);
  expect(payload).toEqual({ status: "ok" });
});

test("renders the setup wizard with the required account fields", async ({ page }) => {
  await page.goto("/setup");

  await expect(page.getByRole("heading", { name: "Welcome to Melodarr" })).toBeVisible();
  await expect(page.getByLabel("Username")).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Confirm Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create Administrator" })).toBeEnabled();
  await expect(page.getByText("Configure Jellyfin and Lidarr in Settings")).toBeVisible();
});

test("validates setup password confirmation before submitting", async ({ page }) => {
  await page.goto("/setup");

  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password", { exact: true }).fill("correct-password");
  await page.getByLabel("Confirm Password").fill("different-password");
  await page.getByRole("button", { name: "Create Administrator" }).click();

  await expect(page.getByText("Passwords do not match.")).toBeVisible();
  await expect(page).toHaveURL(/\/setup$/);
});

test("redirects protected discovery pages to setup before initialization", async ({ page }) => {
  await page.goto("/discover");

  await expect(page).toHaveURL(/\/setup$/);
  await expect(page.getByRole("heading", { name: "Welcome to Melodarr" })).toBeVisible();
});

test("keeps the sticky app header outside the centered content container", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/setup");

  const header = page.locator("header");
  const main = page.locator("main#main-content");

  await expect(header).toBeVisible();
  await expect(main).toBeVisible();
  await expect(page.getByRole("link", { name: "Melodarr" })).toBeVisible();

  await expect(header).toHaveCSS("position", "sticky");
  await expect(header).toHaveCSS("top", "0px");

  const viewportWidth = page.viewportSize()?.width ?? 1280;
  const headerBox = await header.boundingBox();
  const mainBox = await main.boundingBox();

  expect(headerBox).not.toBeNull();
  expect(mainBox).not.toBeNull();
  expect(headerBox?.x).toBeLessThanOrEqual(1);
  expect((headerBox?.x ?? 0) + (headerBox?.width ?? 0)).toBeGreaterThanOrEqual(viewportWidth - 1);
  expect(mainBox?.x).toBeGreaterThan(headerBox?.x ?? 0);
  expect(headerBox?.width).toBeGreaterThan(mainBox?.width ?? 0);
});

test("loads configured private cover images through the signed image proxy", async ({ page }) => {
  const expectedUpstreamUrl = `${IMAGE_ORIGIN}${LONG_REMOTE_IMAGE_PATH}`;
  const optimizerResponses: string[] = [];

  page.on("response", (response) => {
    if (response.url().includes("/_next/image")) {
      optimizerResponses.push(response.url());
    }
  });

  await page.goto("/e2e-cover-image");

  const image = page.getByAltText("Smoke test cover");

  await expect(image).toBeVisible();
  const renderedSrc = await image.getAttribute("src");

  expect(renderedSrc).toBeTruthy();
  expect(renderedSrc?.startsWith("/api/image?")).toBe(true);

  const renderedUrl = new URL(renderedSrc ?? "", page.url());
  expect(renderedUrl.searchParams.get("src")).toBe(expectedUpstreamUrl);
  await expect(image).toHaveJSProperty("naturalWidth", 1);
  expect(optimizerResponses).toHaveLength(0);
});
