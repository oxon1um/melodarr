import { beforeEach, describe, expect, it, vi } from "vitest";

const redisMock = {
  connect: vi.fn(async () => undefined),
  get: vi.fn(),
  set: vi.fn(async () => "OK"),
  incr: vi.fn(async () => 1)
};

vi.mock("@/lib/db/redis", () => ({
  redis: redisMock
}));

describe("json cache", () => {
  beforeEach(async () => {
    redisMock.connect.mockClear();
    redisMock.get.mockReset();
    redisMock.set.mockReset();
    redisMock.incr.mockReset();
    redisMock.set.mockResolvedValue("OK");
    redisMock.incr.mockResolvedValue(1);

    const { clearJsonCache } = await import("../lib/cache/json-cache");
    clearJsonCache();
  });

  it("deduplicates concurrent loads and reuses cached values", async () => {
    redisMock.get.mockResolvedValue(null);

    const { fromJsonCache } = await import("../lib/cache/json-cache");
    const loader = vi.fn(async () => ({ value: "cached" }));

    const [left, right] = await Promise.all([
      fromJsonCache("lidarr:test", "albums", 5_000, loader),
      fromJsonCache("lidarr:test", "albums", 5_000, loader)
    ]);
    const third = await fromJsonCache("lidarr:test", "albums", 5_000, loader);

    expect(left).toEqual({ value: "cached" });
    expect(right).toEqual({ value: "cached" });
    expect(third).toEqual({ value: "cached" });
    expect(loader).toHaveBeenCalledTimes(1);
    expect(redisMock.set).toHaveBeenCalled();
  });

  it("invalidates a namespace by bumping its generation", async () => {
    let generation = 0;
    redisMock.get.mockImplementation(async (key: string) => {
      if (key === "cachegen:lidarr:test") {
        return String(generation);
      }

      return null;
    });
    redisMock.incr.mockImplementation(async () => {
      generation += 1;
      return generation;
    });

    const { fromJsonCache, invalidateJsonCacheNamespace } = await import("../lib/cache/json-cache");
    const loader = vi
      .fn<() => Promise<{ value: number }>>()
      .mockResolvedValueOnce({ value: 1 })
      .mockResolvedValueOnce({ value: 2 });

    const first = await fromJsonCache("lidarr:test", "albums", 5_000, loader);
    await invalidateJsonCacheNamespace("lidarr:test");
    const second = await fromJsonCache("lidarr:test", "albums", 5_000, loader);

    expect(first).toEqual({ value: 1 });
    expect(second).toEqual({ value: 2 });
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
