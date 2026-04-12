import { RequestStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { withOptimizedImageUrlsForMany } from "@/lib/images";
import type { ImageAsset } from "@/lib/image-selection";
import { LidarrClient } from "@/lib/lidarr/client";
import { syncSubmittedAlbumRequests } from "@/lib/requests/service";
import { getRuntimeConfig } from "@/lib/settings/store";

const QUEUED_REQUEST_STATUSES: RequestStatus[] = [
  RequestStatus.PENDING,
  RequestStatus.APPROVED,
  RequestStatus.SUBMITTED
];

const FRESH_PICKS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const FRESH_THIS_WEEK_LIMIT = 10;

export type DiscoverHomeRelease = {
  id: number;
  title: string;
  artistName: string;
  foreignArtistId?: string;
  foreignAlbumId?: string;
  releaseGroup?: "album" | "single";
  releaseDate?: string;
  addedAt?: string;
  images?: ImageAsset[];
};

export type DiscoverHomeData = {
  freshPickCount: number;
  queuedRequestCount: number;
  readyToPlayCount: number;
  freshThisWeek: DiscoverHomeRelease[];
  libraryStatus: "connected" | "not_configured" | "unavailable";
};

type DiscoverLibrarySummary = Pick<
  DiscoverHomeData,
  "freshPickCount" | "readyToPlayCount" | "freshThisWeek" | "libraryStatus"
>;

type FreshPickEntry = {
  album: LibraryAlbum;
  importedAt: string;
};

type LibraryAlbum = {
  id: number;
  title: string;
  foreignAlbumId?: string;
  releaseDate?: string;
  added?: string;
  albumType?: string;
  images?: ImageAsset[];
  statistics?: {
    trackFileCount?: number;
    trackCount?: number;
    totalTrackCount?: number;
    percentOfTracks?: number;
  };
  artist?: {
    artistName?: string;
    foreignArtistId?: string;
  };
};

const emptyDiscoverHomeData: DiscoverHomeData = {
  freshPickCount: 0,
  queuedRequestCount: 0,
  readyToPlayCount: 0,
  freshThisWeek: [],
  libraryStatus: "not_configured"
};

const parseTimestamp = (value?: string): number | null => {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
};

const isFreshPick = (addedAt?: string): boolean => {
  const timestamp = parseTimestamp(addedAt);
  if (timestamp === null) {
    return false;
  }

  return timestamp >= Date.now() - FRESH_PICKS_WINDOW_MS;
};

const toReleaseGroup = (albumType?: string): "album" | "single" | undefined => {
  const normalized = albumType?.trim().toLowerCase();
  if (normalized === "single") {
    return "single";
  }

  if (normalized === "album") {
    return "album";
  }

  return undefined;
};

const toHomeRelease = (album: LibraryAlbum, addedAt = album.added): DiscoverHomeRelease => ({
  id: album.id,
  title: album.title,
  artistName: album.artist?.artistName ?? "Unknown artist",
  foreignArtistId: album.artist?.foreignArtistId,
  foreignAlbumId: album.foreignAlbumId,
  releaseGroup: toReleaseGroup(album.albumType),
  releaseDate: album.releaseDate,
  addedAt,
  images: album.images
});

const compareByImportedDesc = (left: FreshPickEntry, right: FreshPickEntry): number => {
  const leftTimestamp = parseTimestamp(left.importedAt) ?? 0;
  const rightTimestamp = parseTimestamp(right.importedAt) ?? 0;
  return rightTimestamp - leftTimestamp;
};

const getFreshPickEntries = (
  lidarr: LidarrClient,
  availableAlbums: LibraryAlbum[],
  recentImportedAlbums: Array<{ albumId: number; importedAt: string; album?: LibraryAlbum }>
): FreshPickEntry[] => {
  const availableAlbumsById = new Map(availableAlbums.map((album) => [album.id, album]));
  const latestImportsByAlbumId = new Map<number, FreshPickEntry>();

  for (const importedAlbum of recentImportedAlbums) {
    if (!isFreshPick(importedAlbum.importedAt)) {
      continue;
    }

    const availableAlbum = availableAlbumsById.get(importedAlbum.albumId)
      ?? (
        importedAlbum.album && lidarr.isAlbumFullyAvailable(importedAlbum.album)
          ? importedAlbum.album
          : undefined
      );

    if (!availableAlbum) {
      continue;
    }

    const existingEntry = latestImportsByAlbumId.get(availableAlbum.id);
    const existingTimestamp = parseTimestamp(existingEntry?.importedAt) ?? 0;
    const importedTimestamp = parseTimestamp(importedAlbum.importedAt) ?? 0;

    if (existingEntry && existingTimestamp >= importedTimestamp) {
      continue;
    }

    latestImportsByAlbumId.set(availableAlbum.id, {
      album: availableAlbum,
      importedAt: importedAlbum.importedAt
    });
  }

  return Array.from(latestImportsByAlbumId.values()).sort(compareByImportedDesc);
};

const getQueuedRequestCount = async (): Promise<number> => prisma.request.count({
  where: {
    status: {
      in: QUEUED_REQUEST_STATUSES
    }
  }
});

const getUnavailableDiscoverHomeData = (queuedRequestCount: number): DiscoverHomeData => ({
  ...emptyDiscoverHomeData,
  queuedRequestCount,
  libraryStatus: "unavailable"
});

const getLibrarySummary = async (lidarr: LidarrClient): Promise<DiscoverLibrarySummary> => {
  const libraryAlbums = (await lidarr.getAllAlbums()) as LibraryAlbum[];
  if (libraryAlbums.length === 0) {
    return {
      freshPickCount: 0,
      readyToPlayCount: 0,
      freshThisWeek: [],
      libraryStatus: "connected"
    };
  }

  const fallbackFileCounts = await lidarr.getAlbumFileCounts(
    libraryAlbums
      .filter((album) => lidarr.albumNeedsFileCountFallback(album))
      .map((album) => album.id)
  );

  const availableAlbums = libraryAlbums.filter((album) =>
    lidarr.isAlbumFullyAvailable(album, fallbackFileCounts[album.id] ?? 0)
  );
  const freshPicks = getFreshPickEntries(
    lidarr,
    availableAlbums,
    await lidarr.getRecentImportedAlbums(FRESH_PICKS_WINDOW_MS)
  );

  const freshThisWeek = freshPicks.slice(0, FRESH_THIS_WEEK_LIMIT);

  return {
    freshPickCount: freshPicks.length,
    readyToPlayCount: availableAlbums.length,
    freshThisWeek: await withOptimizedImageUrlsForMany(
      freshThisWeek.map(({ album, importedAt }) => toHomeRelease(album, importedAt))
    ),
    libraryStatus: "connected"
  };
};

export const getDiscoverHomeData = async (): Promise<DiscoverHomeData> => {
  const config = await getRuntimeConfig();
  if (!config.lidarrUrl || !config.lidarrApiKey) {
    return {
      ...emptyDiscoverHomeData,
      queuedRequestCount: await getQueuedRequestCount()
    };
  }

  try {
    const lidarr = new LidarrClient(config.lidarrUrl, config.lidarrApiKey);
    const isAvailable = await lidarr.isAvailable();

    if (!isAvailable) {
      return getUnavailableDiscoverHomeData(await getQueuedRequestCount());
    }

    await syncSubmittedAlbumRequests();
    const queuedRequestCount = await getQueuedRequestCount();

    const librarySummary = await getLibrarySummary(lidarr);

    return {
      ...librarySummary,
      queuedRequestCount
    };
  } catch {
    return getUnavailableDiscoverHomeData(await getQueuedRequestCount());
  }
};
