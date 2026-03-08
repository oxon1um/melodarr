import { redis } from "@/lib/db/redis";

type RateLimitConfig = {
  max: number;
  windowSec: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
};

const memoryStore = new Map<string, { count: number; resetAt: number }>();

const inMemoryLimit = (key: string, config: RateLimitConfig): RateLimitResult => {
  const now = Date.now();
  const current = memoryStore.get(key);

  if (!current || current.resetAt <= now) {
    memoryStore.set(key, { count: 1, resetAt: now + config.windowSec * 1000 });
    return { allowed: true, remaining: config.max - 1, retryAfterSec: config.windowSec };
  }

  current.count += 1;
  memoryStore.set(key, current);

  const remaining = Math.max(0, config.max - current.count);
  const retryAfterSec = Math.ceil((current.resetAt - now) / 1000);

  return {
    allowed: current.count <= config.max,
    remaining,
    retryAfterSec
  };
};

export const enforceRateLimit = async (
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> => {
  if (!redis) {
    return inMemoryLimit(key, config);
  }

  try {
    const redisKey = `ratelimit:${key}`;
    await redis.connect().catch(() => undefined);

    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.expire(redisKey, config.windowSec);
    }

    const ttl = await redis.ttl(redisKey);
    const remaining = Math.max(0, config.max - count);

    return {
      allowed: count <= config.max,
      remaining,
      retryAfterSec: ttl > 0 ? ttl : config.windowSec
    };
  } catch {
    return inMemoryLimit(key, config);
  }
};
