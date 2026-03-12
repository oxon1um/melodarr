import { redis } from "@/lib/db/redis";

type CacheEntry = {
  expiresAt: number;
  value: unknown;
};

const memoryStore = new Map<string, CacheEntry>();
const inFlightStore = new Map<string, Promise<unknown>>();
const fallbackGenerationStore = new Map<string, number>();

const getGenerationKey = (namespace: string) => `cachegen:${namespace}`;

const clearNamespaceEntries = (namespace: string) => {
  for (const key of memoryStore.keys()) {
    if (key.startsWith(`${namespace}:`)) {
      memoryStore.delete(key);
    }
  }

  for (const key of inFlightStore.keys()) {
    if (key.startsWith(`${namespace}:`)) {
      inFlightStore.delete(key);
    }
  }
};

const getCachedMemoryValue = <T>(key: string): T | undefined => {
  const cached = memoryStore.get(key);
  if (!cached) {
    return undefined;
  }

  if (cached.expiresAt <= Date.now()) {
    memoryStore.delete(key);
    return undefined;
  }

  return cached.value as T;
};

const setCachedMemoryValue = (key: string, value: unknown, ttlMs: number) => {
  memoryStore.set(key, {
    expiresAt: Date.now() + ttlMs,
    value
  });
};

const getFallbackGeneration = (namespace: string) =>
  fallbackGenerationStore.get(namespace) ?? 0;

const connectRedis = async () => {
  if (!redis) {
    return null;
  }

  await redis.connect().catch(() => undefined);
  return redis;
};

const getGeneration = async (namespace: string): Promise<number> => {
  const client = await connectRedis();
  if (!client) {
    return getFallbackGeneration(namespace);
  }

  try {
    const current = await client.get(getGenerationKey(namespace));
    if (!current) {
      await client.set(getGenerationKey(namespace), "0");
      return 0;
    }

    const parsed = Number.parseInt(current, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return getFallbackGeneration(namespace);
  }
};

const setRedisValue = async (key: string, value: unknown, ttlMs: number) => {
  const client = await connectRedis();
  if (!client) {
    return;
  }

  await client.set(key, JSON.stringify({ value }), "PX", ttlMs);
};

const getRedisValue = async <T>(key: string): Promise<T | undefined> => {
  const client = await connectRedis();
  if (!client) {
    return undefined;
  }

  try {
    const payload = await client.get(key);
    if (!payload) {
      return undefined;
    }

    const parsed = JSON.parse(payload) as { value?: T };
    return parsed.value;
  } catch {
    return undefined;
  }
};

export const clearJsonCache = (): void => {
  memoryStore.clear();
  inFlightStore.clear();
  fallbackGenerationStore.clear();
};

export const invalidateJsonCacheNamespace = async (namespace: string): Promise<void> => {
  clearNamespaceEntries(namespace);

  const client = await connectRedis();
  if (!client) {
    fallbackGenerationStore.set(namespace, getFallbackGeneration(namespace) + 1);
    return;
  }

  try {
    const nextGeneration = await client.incr(getGenerationKey(namespace));
    fallbackGenerationStore.set(namespace, nextGeneration);
  } catch {
    fallbackGenerationStore.set(namespace, getFallbackGeneration(namespace) + 1);
  }
};

export const fromJsonCache = async <T>(
  namespace: string,
  scope: string,
  ttlMs: number,
  loader: () => Promise<T>
): Promise<T> => {
  const generation = await getGeneration(namespace);
  const cacheKey = `${namespace}:g${generation}:${scope}`;
  const inFlightKey = `${namespace}:pending:${scope}`;

  const cachedMemory = getCachedMemoryValue<T>(cacheKey);
  if (cachedMemory !== undefined) {
    return cachedMemory;
  }

  const cachedRedis = await getRedisValue<T>(cacheKey);
  if (cachedRedis !== undefined) {
    setCachedMemoryValue(cacheKey, cachedRedis, ttlMs);
    return cachedRedis;
  }

  const pending = inFlightStore.get(inFlightKey);
  if (pending) {
    return pending as Promise<T>;
  }

  const nextPending = loader()
    .then(async (resolved) => {
      setCachedMemoryValue(cacheKey, resolved, ttlMs);
      await setRedisValue(cacheKey, resolved, ttlMs).catch(() => undefined);
      return resolved;
    })
    .finally(() => {
      inFlightStore.delete(inFlightKey);
    });

  inFlightStore.set(inFlightKey, nextPending);
  return nextPending;
};
