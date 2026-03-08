import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/http";
import { LidarrClient } from "@/lib/lidarr/client";
import { getRuntimeConfig } from "@/lib/settings/store";

type AlbumWithStatus = {
  title: string;
  artistName: string;
  foreignAlbumId?: string;
  foreignArtistId?: string;
  overview?: string;
  images?: Array<{ coverType?: string; remoteUrl?: string; url?: string }>;
  isExisting?: boolean;
};

export async function GET(req: NextRequest) {
  try {
    await requireUser(req);

    const query = req.nextUrl.searchParams.get("q")?.trim();
    if (!query || query.length < 2) {
      return jsonOk({ artists: [], albums: [], songs: [] });
    }

    const config = await getRuntimeConfig();
    if (!config.lidarrUrl || !config.lidarrApiKey) {
      return jsonError("Lidarr is not configured", 500);
    }

    const lidarr = new LidarrClient(config.lidarrUrl, config.lidarrApiKey);
    const results = await lidarr.searchDiscover(query);

    // Get existing albums to check if any are already in the library
    const existingAlbums = await lidarr.getAllAlbums();
    const existingAlbumIds = new Set(existingAlbums.map((a) => a.foreignAlbumId).filter(Boolean));

    // Mark albums as existing if they're in the library
    const albumsWithStatus: AlbumWithStatus[] = results.albums.map((album) => ({
      ...album,
      isExisting: existingAlbumIds.has(album.foreignAlbumId)
    }));

    return jsonOk({
      ...results,
      albums: albumsWithStatus
    });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return jsonError(error instanceof Error ? error.message : "Failed to search discovery results", status);
  }
}
