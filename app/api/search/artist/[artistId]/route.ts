import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/http";
import { LidarrClient } from "@/lib/lidarr/client";
import { getRuntimeConfig } from "@/lib/settings/store";

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

    const lidarr = new LidarrClient(config.lidarrUrl, config.lidarrApiKey);

    // Debug: log what we're looking up
    console.log("[artist-detail] Looking up artistId:", artistId);

    // Get artist details from lookup
    const artist = await lidarr.getArtistByForeignId(artistId);
    console.log("[artist-detail] Artist result:", artist);

    // Get albums (from lookup or from existing library)
    const albums = await lidarr.getAlbumsByArtistForeignId(artistId);
    const existingAlbums = await lidarr.getExistingArtistAlbums(artistId);

    // Mark which albums are already in the library
    const existingAlbumIds = new Set(existingAlbums.map((a) => a.foreignAlbumId));
    const albumsWithStatus = albums.map((album) => ({
      ...album,
      isExisting: existingAlbumIds.has(album.foreignAlbumId)
    }));

    return jsonOk({
      artist,
      albums: albumsWithStatus,
      existingCount: existingAlbums.length
    });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return jsonError(error instanceof Error ? error.message : "Failed to get artist details", status);
  }
}
