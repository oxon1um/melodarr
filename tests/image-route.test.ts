import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireUser = vi.fn();
const verifySignedImageParams = vi.fn();
const fetchMock = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  requireUser
}));

vi.mock("@/lib/images", () => ({
  verifySignedImageParams
}));

describe("GET /api/image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("proxies a valid signed image without requiring a session cookie", async () => {
    requireUser.mockRejectedValue(Object.assign(new Error("Unauthorized"), { status: 401 }));
    verifySignedImageParams.mockResolvedValue("https://images.example/stromae.jpg");
    fetchMock.mockResolvedValue(
      new Response("image-bytes", {
        status: 200,
        headers: { "content-type": "image/jpeg" }
      })
    );

    const { GET } = await import("../app/api/image/route");
    const request = new NextRequest("http://localhost:3000/api/image?src=ok&exp=1&sig=ok");
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(requireUser).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://images.example/stromae.jpg",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(await response.text()).toBe("image-bytes");
  });

  it("rejects unsafe private image sources", async () => {
    verifySignedImageParams.mockResolvedValue("http://127.0.0.1:8080/private.jpg");

    const { GET } = await import("../app/api/image/route");
    const request = new NextRequest("http://localhost:3000/api/image?src=ok&exp=1&sig=ok");
    const response = await GET(request);

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ error: "Invalid image source" });
  });

  it("rejects non-image upstream responses", async () => {
    verifySignedImageParams.mockResolvedValue("https://images.example/not-an-image");
    fetchMock.mockResolvedValue(
      new Response("html", {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" }
      })
    );

    const { GET } = await import("../app/api/image/route");
    const request = new NextRequest("http://localhost:3000/api/image?src=ok&exp=1&sig=ok");
    const response = await GET(request);

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toEqual({ error: "Invalid upstream image response" });
  });
});
