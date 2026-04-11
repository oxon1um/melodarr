import { beforeEach, describe, expect, it, vi } from "vitest";
import { RequestStatus, RequestType } from "@prisma/client";

const prismaRequest = {
  findFirst: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  findUnique: vi.fn()
};

const getRuntimeConfig = vi.fn();

const clientInstance = {
  getExistingArtistByForeignId: vi.fn(),
  getEffectiveAddDefaults: vi.fn(),
  getExistingAlbumByForeignId: vi.fn(),
  addArtist: vi.fn(),
  getAlbumsByArtistId: vi.fn(),
  getAlbumsByArtistForeignId: vi.fn(),
  getAlbumById: vi.fn(),
  isAlbumFullyAvailable: vi.fn(),
  setAlbumsMonitored: vi.fn(),
  triggerAlbumSearch: vi.fn(),
  addAlbum: vi.fn()
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

vi.mock("@/lib/lidarr/client", () => ({
  LidarrClient
}));

describe("request service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adds the artist shell, then monitors and searches only the selected release", async () => {
    prismaRequest.findFirst.mockResolvedValue(null);
    prismaRequest.create
      .mockResolvedValueOnce({
        id: "request-1",
        requestType: RequestType.ALBUM,
        artistName: "U2",
        albumTitle: "War",
        status: RequestStatus.APPROVED
      });
    prismaRequest.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "request-1",
      requestType: RequestType.ALBUM,
      artistName: "U2",
      albumTitle: "War",
      ...data
    }));

    getRuntimeConfig.mockResolvedValue({
      lidarrUrl: "http://lidarr",
      lidarrApiKey: "test-key",
      lidarrRootFolder: "/music",
      lidarrQualityProfileId: 7,
      lidarrMetadataProfileId: 3,
      requestAutoApprove: true
    });

    clientInstance.getExistingArtistByForeignId.mockResolvedValue(null);
    clientInstance.getEffectiveAddDefaults.mockResolvedValue({
      rootFolderPath: "/music",
      qualityProfileId: 7,
      metadataProfileId: 3
    });
    clientInstance.getExistingAlbumByForeignId.mockResolvedValue(null);
    clientInstance.addArtist.mockResolvedValue({
      id: 41,
      artistName: "U2",
      foreignArtistId: "artist-u2",
      qualityProfileId: 7,
      metadataProfileId: 3,
      rootFolderPath: "/music"
    });
    clientInstance.getAlbumsByArtistId.mockResolvedValue([
      {
        id: 99,
        title: "War",
        foreignAlbumId: "album-war",
        artistName: "U2",
        foreignArtistId: "artist-u2"
      }
    ]);
    clientInstance.getAlbumById.mockResolvedValue({
      id: 99,
      title: "War",
      foreignAlbumId: "album-war",
      artist: {
        artistName: "U2",
        foreignArtistId: "artist-u2"
      }
    });
    clientInstance.setAlbumsMonitored.mockResolvedValue(undefined);
    clientInstance.triggerAlbumSearch.mockResolvedValue(undefined);

    const { createAlbumRequest } = await import("../lib/requests/service");
    const result = await createAlbumRequest({
      requestedById: "user-1",
      artistName: "U2",
      albumTitle: "War",
      foreignArtistId: "artist-u2",
      foreignAlbumId: "album-war"
    });

    expect(clientInstance.addArtist).toHaveBeenCalledWith(
      expect.objectContaining({
        artistName: "U2",
        foreignArtistId: "artist-u2",
        monitorMode: "none",
        monitored: false,
        searchForMissingAlbums: false
      })
    );
    expect(clientInstance.setAlbumsMonitored).toHaveBeenCalledWith([99], true);
    expect(clientInstance.triggerAlbumSearch).toHaveBeenCalledWith([99]);
    expect(clientInstance.addAlbum).not.toHaveBeenCalled();
    expect(result.request).toMatchObject({
      status: RequestStatus.SUBMITTED,
      lidarrArtistId: 41,
      lidarrAlbumId: 99
    });
  });

  it("monitors existing unmonitored albums and marks request as SUBMITTED, not ALREADY_EXISTS", async () => {
    prismaRequest.findFirst.mockResolvedValue(null);
    prismaRequest.create.mockResolvedValueOnce({
      id: "request-2",
      requestType: RequestType.ALBUM,
      artistName: "U2",
      albumTitle: "War",
      status: RequestStatus.APPROVED
    });
    prismaRequest.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "request-2",
      requestType: RequestType.ALBUM,
      ...data
    }));

    getRuntimeConfig.mockResolvedValue({
      lidarrUrl: "http://lidarr",
      lidarrApiKey: "test-key",
      requestAutoApprove: true
    });

    clientInstance.getExistingArtistByForeignId.mockResolvedValue({
      id: 41,
      artistName: "U2",
      foreignArtistId: "artist-u2"
    });

    clientInstance.getEffectiveAddDefaults.mockResolvedValue({
      rootFolderPath: "/music",
      qualityProfileId: 7,
      metadataProfileId: 3
    });

    clientInstance.getExistingAlbumByForeignId.mockResolvedValue({
      id: 99,
      title: "War",
      foreignAlbumId: "album-war",
      monitored: false
    });

    clientInstance.setAlbumsMonitored.mockResolvedValue(undefined);
    clientInstance.triggerAlbumSearch.mockResolvedValue(undefined);

    const { createAlbumRequest } = await import("../lib/requests/service");
    const result = await createAlbumRequest({
      requestedById: "user-1",
      artistName: "U2",
      albumTitle: "War",
      foreignArtistId: "artist-u2",
      foreignAlbumId: "album-war"
    });

    // We shouldn't add an artist because getExistingAlbumByForeignId succeeds and returns early
    expect(clientInstance.addArtist).not.toHaveBeenCalled();
    expect(clientInstance.setAlbumsMonitored).toHaveBeenCalledWith([99], true);
    expect(clientInstance.triggerAlbumSearch).toHaveBeenCalledWith([99]);
    expect(result.request).toMatchObject({
      status: RequestStatus.SUBMITTED,
      lidarrArtistId: 41,
      lidarrAlbumId: 99
    });
  });

  it("marks submitted album requests as COMPLETED when Lidarr reports full availability", async () => {
    prismaRequest.findMany.mockResolvedValue([
      {
        id: "request-3",
        requestType: RequestType.ALBUM,
        status: RequestStatus.SUBMITTED,
        lidarrAlbumId: 99
      }
    ]);
    prismaRequest.update.mockImplementation(async ({ where, data }: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => ({
      id: where.id,
      ...data
    }));

    getRuntimeConfig.mockResolvedValue({
      lidarrUrl: "http://lidarr",
      lidarrApiKey: "test-key"
    });

    clientInstance.getAlbumById.mockResolvedValue({
      id: 99,
      title: "1984",
      statistics: {
        trackFileCount: 10,
        trackCount: 10
      }
    });
    clientInstance.isAlbumFullyAvailable.mockReturnValue(true);

    const { syncSubmittedAlbumRequests } = await import("../lib/requests/service");
    const result = await syncSubmittedAlbumRequests();

    expect(clientInstance.getAlbumById).toHaveBeenCalledWith(99);
    expect(clientInstance.isAlbumFullyAvailable).toHaveBeenCalledWith(
      expect.objectContaining({ id: 99 })
    );
    expect(prismaRequest.update).toHaveBeenCalledWith({
      where: { id: "request-3" },
      data: {
        status: RequestStatus.COMPLETED,
        failureReason: null
      }
    });
    expect(result).toEqual(["request-3"]);
  });

  it("leaves submitted album requests as SUBMITTED when Lidarr does not report full availability", async () => {
    prismaRequest.findMany.mockResolvedValue([
      {
        id: "request-4",
        requestType: RequestType.ALBUM,
        status: RequestStatus.SUBMITTED,
        lidarrAlbumId: 44
      }
    ]);

    getRuntimeConfig.mockResolvedValue({
      lidarrUrl: "http://lidarr",
      lidarrApiKey: "test-key"
    });

    clientInstance.getAlbumById.mockResolvedValue({
      id: 44,
      title: "1984",
      statistics: {
        trackFileCount: 1,
        trackCount: 10
      }
    });
    clientInstance.isAlbumFullyAvailable.mockReturnValue(false);

    const { syncSubmittedAlbumRequests } = await import("../lib/requests/service");
    const result = await syncSubmittedAlbumRequests();

    expect(prismaRequest.update).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});
