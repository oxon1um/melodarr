import Redis from "ioredis";
import { env } from "@/lib/env";

declare global {
  var __redis: Redis | undefined;
}

export const redis = (() => {
  if (!env.redisUrl) return null;

  if (!global.__redis) {
    global.__redis = new Redis(env.redisUrl, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      lazyConnect: true
    });
  }

  return global.__redis;
})();
