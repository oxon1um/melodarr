import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/http";
import { LidarrClient } from "@/lib/lidarr/client";
import { getRuntimeConfig } from "@/lib/settings/store";

export async function GET(req: NextRequest, { params }: { params: Promise<{ albumId: string }> }) {
  try {
    await requireUser(req);

    const { albumId } = await params;
    if (!albumId) {
      return jsonError("Album ID is required", 400);
    }

    const config = await getRuntimeConfig();
    if (!config.lidarrUrl || !config.lidarrApiKey) {
      return jsonError("Lidarr is not configured", 500);
    }

    const lidarr = new LidarrClient(config.lidarrUrl, config.lidarrApiKey, config.debugMode);
    const artistName = req.nextUrl.searchParams.get("artistName") || undefined;

    // Debug: log what we're looking up
    if (config.debugMode) console.log("[album-detail] Looking up albumId:", albumId, "artistName:", artistName);

    // Get album details from lookup
    const album = await lidarr.getAlbumByForeignId(albumId, artistName);
    if (config.debugMode) console.log("[album-detail] Album result:", album);

    if (!album) {
      return jsonError("Album not found", 404);
    }

    // Get tracks for the album
    const tracks = await lidarr.getAlbumTracks(albumId, artistName);
    if (config.debugMode) console.log("[album-detail] Tracks result:", JSON.stringify(tracks, null, 2));

    // Check if album is already tracked and whether it has files
    const existingAlbum = await lidarr.getExistingAlbumByForeignId(albumId);
    const fileCounts = existingAlbum && lidarr.albumNeedsFileCountFallback(existingAlbum)
      ? await lidarr.getAlbumFileCounts([existingAlbum.id])
      : {};

    return jsonOk({
      album,
      tracks,
      isTracked: existingAlbum?.monitored === true,
      hasFiles: existingAlbum
        ? lidarr.isAlbumFullyAvailable(existingAlbum, fileCounts[existingAlbum.id] ?? 0)
        : false
    });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return jsonError(error instanceof Error ? error.message : "Failed to get album details", status);
  }
}
