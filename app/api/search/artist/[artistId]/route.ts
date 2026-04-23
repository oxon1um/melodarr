import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/http";
import { withOptimizedImageUrls, withOptimizedImageUrlsForMany } from "@/lib/images";
import { LidarrClient } from "@/lib/lidarr/client";
import { getRuntimeConfig } from "@/lib/settings/store";

const normalizeText = (value: string | undefined) => value?.trim().toLowerCase() ?? "";

export async function GET(req: NextRequest, { params }: { params: Promise<{ artistId: string }> }) {
  try {
    await requireUser(req);

    const { artistId } = await params;
    if (!artistId) {
      return jsonError("Artist ID is required", 400);
    }

    const config = await getRuntimeConfig();
    if (!config.lidarrUrl || !config.lidarrApiKey) {
      return jsonError("Lidarr is not configured", 500);
    }

    const lidarr = new LidarrClient(config.lidarrUrl, config.lidarrApiKey, config.debugMode);

    const url = new URL(req.url);
    const artistName = url.searchParams.get("artistName") || undefined;

    const artist = await lidarr.getArtistByForeignId(artistId, artistName);
    if (!artist) {
      return jsonError("Artist not found", 404);
    }

    const releases = await lidarr.getGroupedReleasesByArtistForeignId(
      artistId,
      artistName,
      artist,
      config.lidarrMetadataProfileId
    );

    const artistInternalId = artist.id;
    const allAlbumsInLibrary = await lidarr.getAllAlbums();
    const trackedAlbums = allAlbumsInLibrary.filter((album) => {
      if (artistInternalId && album.artistId === artistInternalId) {
        return true;
      }

      if (album.artist?.foreignArtistId && album.artist.foreignArtistId === artistId) {
        return true;
      }

      return normalizeText(album.artist?.artistName) === normalizeText(artist.artistName);
    });
    const fallbackTrackedAlbums = trackedAlbums.filter((album) =>
      lidarr.albumNeedsFileCountFallback(album)
    );
    const fileCounts = await lidarr.getAlbumFileCounts(fallbackTrackedAlbums.map((album) => album.id));
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
    const mapStatus = (album: typeof releases.albums[number]) => ({
      ...album,
      ...(function resolveStatus() {
        const trackedAlbum = album.foreignAlbumId
          ? trackedByForeignId.get(album.foreignAlbumId)
          : trackedByName.get(`${normalizeText(album.artistName ?? artist.artistName)}:${normalizeText(album.title)}`);

        return {
          isTracked: trackedAlbum?.monitored === true,
          hasFiles: trackedAlbum
            ? lidarr.isAlbumFullyAvailable(trackedAlbum, fileCounts[trackedAlbum.id] ?? 0)
            : false
        };
      })()
    });
    const mappedAlbums = releases.albums.map(mapStatus);
    const mappedSingles = releases.singles.map(mapStatus);
    const trackedCount = [...mappedAlbums, ...mappedSingles].filter((album) => album.isTracked).length;
    const availableCount = [...mappedAlbums, ...mappedSingles].filter((album) => album.hasFiles).length;

    return jsonOk({
      artist: await withOptimizedImageUrls(artist),
      albums: await withOptimizedImageUrlsForMany(mappedAlbums),
      singles: await withOptimizedImageUrlsForMany(mappedSingles),
      trackedCount,
      availableCount
    });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return jsonError(error instanceof Error ? error.message : "Failed to get artist details", status);
  }
}
