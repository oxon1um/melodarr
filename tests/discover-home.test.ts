import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaRequest = {
  count: vi.fn()
};

const getRuntimeConfig = vi.fn();
const syncSubmittedAlbumRequests = vi.fn();
const withOptimizedImageUrlsForMany = vi.fn(async <T>(items: T[]) => items);

const clientInstance = {
  isAvailable: vi.fn(),
  getAllAlbums: vi.fn(),
  getAlbumFileCounts: vi.fn(),
  albumNeedsFileCountFallback: vi.fn(),
  isAlbumFullyAvailable: vi.fn(),
  getRecentImportedAlbums: vi.fn()
};

const LidarrClient = vi.fn(function LidarrClientMock() {
  return clientInstance;
});

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    request: prismaRequest
  }
}));

vi.mock("@/lib/settings/store", () => ({
  getRuntimeConfig
}));

vi.mock("@/lib/requests/service", () => ({
  syncSubmittedAlbumRequests
}));

vi.mock("@/lib/images", () => ({
  withOptimizedImageUrlsForMany
}));

vi.mock("@/lib/lidarr/client", () => ({
  LidarrClient
}));

describe("getDiscoverHomeData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clientInstance.getAlbumFileCounts.mockResolvedValue({});
    clientInstance.albumNeedsFileCountFallback.mockReturnValue(false);
  });

  it("uses recent imported history for fresh picks and syncs submitted requests before counting queue", async () => {
    const callOrder: string[] = [];
    const importedAt = new Date(Date.now() - 60_000).toISOString();

    getRuntimeConfig.mockResolvedValue({
      lidarrUrl: "http://lidarr",
      lidarrApiKey: "test-key"
    });
    clientInstance.isAvailable.mockResolvedValue(true);
    clientInstance.getAllAlbums.mockResolvedValue([
      {
        id: 99,
        title: "1984",
        foreignAlbumId: "album-1984",
        albumType: "Album",
        artist: {
          artistName: "Van Halen",
          foreignArtistId: "artist-van-halen"
        },
        statistics: {
          trackFileCount: 9,
          trackCount: 9
        }
      },
      {
        id: 100,
        title: "Unavailable",
        artist: {
          artistName: "Van Halen"
        },
        statistics: {
          trackFileCount: 1,
          trackCount: 9
        }
      }
    ]);
    clientInstance.isAlbumFullyAvailable.mockImplementation((album: { id: number; statistics?: { trackFileCount?: number; trackCount?: number } }) =>
      album.id === 99 && album.statistics?.trackFileCount === album.statistics?.trackCount
    );
    clientInstance.getRecentImportedAlbums.mockResolvedValue([
      {
        albumId: 99,
        importedAt: new Date(Date.now() - 120_000).toISOString()
      },
      {
        albumId: 99,
        importedAt
      },
      {
        albumId: 100,
        importedAt
      }
    ]);
    syncSubmittedAlbumRequests.mockImplementation(async () => {
      callOrder.push("sync");
      return ["request-1"];
    });
    prismaRequest.count.mockImplementation(async () => {
      callOrder.push("count");
      return 0;
    });

    const { getDiscoverHomeData } = await import("../lib/discover/home");
    const result = await getDiscoverHomeData();

    expect(syncSubmittedAlbumRequests).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual(["sync", "count"]);
    expect(result.queuedRequestCount).toBe(0);
    expect(result.readyToPlayCount).toBe(1);
    expect(result.freshPickCount).toBe(1);
    expect(result.freshThisWeek).toEqual([
      expect.objectContaining({
        id: 99,
        title: "1984",
        artistName: "Van Halen",
        addedAt: importedAt
      })
    ]);
  });

  it("returns unavailable state with queued count when Lidarr cannot be reached", async () => {
    getRuntimeConfig.mockResolvedValue({
      lidarrUrl: "http://lidarr",
      lidarrApiKey: "test-key"
    });
    clientInstance.isAvailable.mockResolvedValue(false);
    prismaRequest.count.mockResolvedValue(2);

    const { getDiscoverHomeData } = await import("../lib/discover/home");
    const result = await getDiscoverHomeData();

    expect(syncSubmittedAlbumRequests).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      freshPickCount: 0,
      queuedRequestCount: 2,
      readyToPlayCount: 0,
      freshThisWeek: [],
      libraryStatus: "unavailable"
    });
  });
});
