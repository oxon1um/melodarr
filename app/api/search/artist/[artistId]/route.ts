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

    const lidarr = new LidarrClient(config.lidarrUrl, config.lidarrApiKey, config.debugMode);

    // Add log for incoming artistId
    if (config.debugMode) console.log("[artist-detail] Received artistId:", artistId);

    // Get artist details from lookup
    const artist = await lidarr.getArtistByForeignId(artistId);
    if (!artist) {
      return jsonError("Artist not found", 404);
    }
    if (config.debugMode) console.log("[artist-detail] Artist result:", artist);

    // Get albums (from lookup or from existing library)
    const albums = await lidarr.getAlbumsByArtistForeignId(artistId);
    if (config.debugMode) console.log("[artist-detail] Albums result:", JSON.stringify(albums, null, 2));
    const existingAlbums = await lidarr.getExistingArtistAlbums(artistId);
    if (config.debugMode) console.log("[artist-detail] Existing albums:", JSON.stringify(existingAlbums, null, 2));

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
