import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const upsert = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    appConfig: {
      findUnique,
      upsert
    }
  }
}));

vi.mock("@/lib/env", () => ({
  env: {
    appUrl: undefined
  }
}));

describe("runtime app config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty stored runtime fields when app config has not been created", async () => {
    findUnique.mockResolvedValue(null);

    const { getStoredRuntimeFields } = await import("../lib/runtime/app-config");
    const result = await getStoredRuntimeFields();

    expect(result).toEqual({
      appUrl: null,
      runtimeSecret: null,
      jellyfinApiKeyEncrypted: null,
      lidarrApiKeyEncrypted: null
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("falls back to localhost app url without writing config", async () => {
    findUnique.mockResolvedValue({
      appUrl: null,
      runtimeSecret: null,
      jellyfinApiKeyEncrypted: null,
      lidarrApiKeyEncrypted: null
    });

    const { getEffectiveAppUrl } = await import("../lib/runtime/app-config");
    const result = await getEffectiveAppUrl();

    expect(result).toBe("http://localhost:3000");
    expect(upsert).not.toHaveBeenCalled();
  });
});
