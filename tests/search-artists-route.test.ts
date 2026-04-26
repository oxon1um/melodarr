import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireUser = vi.fn();
const getRuntimeConfig = vi.fn();
const searchDiscover = vi.fn();
const getAllAlbums = vi.fn();
const getAlbumFileCounts = vi.fn();
const withOptimizedImageUrlsForMany = vi.fn(async (items: unknown[]) => items);

vi.mock("@/lib/auth/session", () => ({
  requireUser,
}));

vi.mock("@/lib/settings/store", () => ({
  getRuntimeConfig,
}));

vi.mock("@/lib/images", () => ({
  withOptimizedImageUrlsForMany,
}));

vi.mock("@/lib/lidarr/client", () => ({
  LidarrClient: vi.fn(function LidarrClient() {
    return {
      searchDiscover,
      getAllAlbums,
      getAlbumFileCounts,
      albumNeedsFileCountFallback: vi.fn(() => false),
      isAlbumFullyAvailable: vi.fn(() => false),
    };
  }),
}));

describe("GET /api/search/artists", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ id: "user-1" });
    getRuntimeConfig.mockResolvedValue({
      lidarrUrl: "http://lidarr.local",
      lidarrApiKey: "lidarr-key",
      lidarrMetadataProfileId: 1,
    });
    searchDiscover.mockResolvedValue({ artists: [], albums: [], singles: [] });
    getAllAlbums.mockResolvedValue([]);
    getAlbumFileCounts.mockResolvedValue({});
  });

  it("does not leak raw Lidarr stack traces when search fails", async () => {
    searchDiscover.mockRejectedValue(
      new Error(
        "Lidarr API error (500): System.InvalidOperationException: broken\n" +
          "at Microsoft.AspNetCore.Mvc.Infrastructure.ResourceInvoker.InvokeAsync()"
      )
    );

    const { GET } = await import("../app/api/search/artists/route");
    const request = new NextRequest("http://localhost:3000/api/search/artists?q=obscure");
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload).toEqual({
      error: "Lidarr search failed. Check Lidarr logs for details.",
    });
  });
});
