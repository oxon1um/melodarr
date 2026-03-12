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
