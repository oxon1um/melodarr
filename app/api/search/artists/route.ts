import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/http";
import { withOptimizedImageUrlsForMany } from "@/lib/images";
import { LidarrClient } from "@/lib/lidarr/client";
import { getRuntimeConfig } from "@/lib/settings/store";

const normalizeText = (value: string | undefined) => value?.trim().toLowerCase() ?? "";

type AlbumWithStatus = {
  title: string;
  artistName: string;
  foreignAlbumId?: string;
  foreignArtistId?: string;
  releaseGroup?: "album" | "single";
  releaseDate?: string;
  overview?: string;
  images?: Array<{ coverType?: string; remoteUrl?: string; url?: string }>;
  isTracked?: boolean;
  hasFiles?: boolean;
};

export async function GET(req: NextRequest) {
  try {
    await requireUser(req);

    const query = req.nextUrl.searchParams.get("q")?.trim();
    if (!query || query.length < 2) {
      return jsonOk({ artists: [], albums: [], singles: [] });
    }

    const config = await getRuntimeConfig();
    if (!config.lidarrUrl || !config.lidarrApiKey) {
      return jsonError("Lidarr is not configured", 500);
    }

    const lidarr = new LidarrClient(config.lidarrUrl, config.lidarrApiKey);
    const results = await lidarr.searchDiscover(query, config.lidarrMetadataProfileId);

    const trackedAlbums = await lidarr.getAllAlbums();
    const trackedByForeignId = new Map(
      trackedAlbums
        .filter((album) => album.foreignAlbumId)
        .map((album) => [album.foreignAlbumId as string, album])
    );
    const trackedByName = new Map(
      trackedAlbums.map((album) => [
        `${normalizeText(album.artist?.artistName)}:${normalizeText(album.title)}`,
        album
      ])
    );
    const relevantTrackedAlbums = [...results.albums, ...results.singles]
      .map((album) =>
        album.foreignAlbumId
          ? trackedByForeignId.get(album.foreignAlbumId)
          : trackedByName.get(`${normalizeText(album.artistName)}:${normalizeText(album.title)}`)
      )
      .filter((album): album is NonNullable<typeof album> => Boolean(album));
    const fallbackTrackedAlbums = relevantTrackedAlbums.filter((album) =>
      lidarr.albumNeedsFileCountFallback(album)
    );
    const fileCounts = await lidarr.getAlbumFileCounts(fallbackTrackedAlbums.map((album) => album.id));

    const mapStatus = (album: typeof results.albums[number]): AlbumWithStatus => ({
      ...album,
      ...(function resolveStatus() {
        const trackedAlbum = album.foreignAlbumId
          ? trackedByForeignId.get(album.foreignAlbumId)
          : trackedByName.get(`${normalizeText(album.artistName)}:${normalizeText(album.title)}`);

        return {
          isTracked: trackedAlbum?.monitored === true,
          hasFiles: trackedAlbum
            ? lidarr.isAlbumFullyAvailable(trackedAlbum, fileCounts[trackedAlbum.id] ?? 0)
            : false
        };
      })()
    });

    const albumsWithStatus: AlbumWithStatus[] = results.albums.map(mapStatus);
    const singlesWithStatus: AlbumWithStatus[] = results.singles.map(mapStatus);

    return jsonOk({
      artists: await withOptimizedImageUrlsForMany(results.artists),
      albums: await withOptimizedImageUrlsForMany(albumsWithStatus),
      singles: await withOptimizedImageUrlsForMany(singlesWithStatus)
    });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return jsonError(error instanceof Error ? error.message : "Failed to search discovery results", status);
  }
}
