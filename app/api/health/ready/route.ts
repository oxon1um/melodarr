import { prisma } from "@/lib/db/prisma";
import { redis } from "@/lib/db/redis";
import { jsonError, jsonOk } from "@/lib/http";
import { getRuntimeConfig } from "@/lib/settings/store";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    if (redis) {
      await redis.connect().catch(() => undefined);
      await redis.ping();
    }

    const config = await getRuntimeConfig();
    const hasJellyfin = Boolean(config.jellyfinUrl && config.jellyfinApiKey);
    const hasLidarr = Boolean(config.lidarrUrl && config.lidarrApiKey);

    if (!hasJellyfin || !hasLidarr) {
      return jsonError("Missing Jellyfin or Lidarr configuration", 503);
    }

    return jsonOk({ status: "ready" });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Not ready", 503);
  }
}
