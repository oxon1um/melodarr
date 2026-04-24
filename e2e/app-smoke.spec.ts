import { createHmac } from "node:crypto";
import { createServer, type Server } from "node:http";
import { test, expect } from "@playwright/test";

const IMAGE_UPSTREAM_PORT = Number.parseInt(process.env.PLAYWRIGHT_IMAGE_UPSTREAM_PORT ?? "45731", 10);
const IMAGE_ORIGIN = `http://127.0.0.1:${IMAGE_UPSTREAM_PORT}`;
const SESSION_SECRET = process.env.SESSION_SECRET ?? "playwright-test-session-secret-with-enough-entropy-for-ci";
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

let imageServer: Server;

const encodeSignature = (value: Buffer): string =>
  value
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const createSignedImagePath = (src: string): string => {
  const expiresAt = Math.floor(Date.now() / 1000) + 60;
  const signature = encodeSignature(
    createHmac("sha256", SESSION_SECRET)
      .update(`${src}:${expiresAt}`)
      .digest(),
  );

  const params = new URLSearchParams({
    src,
    exp: String(expiresAt),
    sig: signature,
  });

  return `/api/image?${params.toString()}`;
};

test.beforeAll(async () => {
  imageServer = createServer((req, res) => {
    if (req.url === "/cover.png") {
      res.writeHead(200, {
        "Content-Type": "image/png",
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
  await page.goto("/setup");

  const imagePath = createSignedImagePath(`${IMAGE_ORIGIN}/cover.png`);
  const responsePromise = page.waitForResponse((response) =>
    response.url().includes("/api/image") && response.status() === 200,
  );

  await page.evaluate((src) => {
    const image = document.createElement("img");
    image.alt = "Smoke test cover";
    image.src = src;
    image.dataset.testid = "smoke-cover";
    document.body.append(image);
  }, imagePath);

  const response = await responsePromise;
  await expect(page.locator("img[data-testid='smoke-cover']")).toHaveJSProperty("naturalWidth", 1);
  expect(response.headers()["content-type"]).toContain("image/png");
});
