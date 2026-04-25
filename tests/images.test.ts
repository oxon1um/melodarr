import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/runtime/secret", () => ({
  getRuntimeSecret: vi.fn(async () => "test-secret")
}));

describe("image signing", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("builds and verifies signed image URLs", async () => {
    const { buildSignedImageUrl, verifySignedImageParams } = await import("../lib/images");
    const signed = await buildSignedImageUrl("https://example.com/cover.jpg");

    expect(signed).toMatch(/^\/api\/image\?/);

    const params = new URLSearchParams(signed?.split("?")[1]);
    const verified = await verifySignedImageParams(params);

    expect(verified).toBe("https://example.com/cover.jpg");
  });

  it("prefers Lidarr-served image URLs over external remote URLs", async () => {
    const { verifySignedImageParams, withOptimizedImageUrls } = await import("../lib/images");
    const result = await withOptimizedImageUrls({
      images: [
        {
          coverType: "poster",
          remoteUrl: "https://external.example/broken-cover.jpg",
          url: "http://lidarr:8686/MediaCover/1/poster.jpg"
        }
      ]
    });

    const signed = result.images?.[0]?.optimizedUrl;
    expect(signed).toMatch(/^\/api\/image\?/);

    const params = new URLSearchParams(signed?.split("?")[1]);
    await expect(verifySignedImageParams(params)).resolves.toBe(
      "http://lidarr:8686/MediaCover/1/poster.jpg"
    );
  });

  it("rejects expired or invalid sources", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-12T12:00:00Z"));

    const { buildSignedImageUrl, verifySignedImageParams } = await import("../lib/images");
    const signed = await buildSignedImageUrl("https://example.com/cover.jpg");
    const params = new URLSearchParams(signed?.split("?")[1]);

    vi.setSystemTime(new Date("2026-03-14T12:00:01Z"));
    await expect(verifySignedImageParams(params)).resolves.toBeNull();
    await expect(buildSignedImageUrl("file:///tmp/image.png")).resolves.toBeUndefined();
  });

});
