import { beforeEach, describe, expect, it, vi } from "vitest";

const getStoredRuntimeFields = vi.fn();
const upsert = vi.fn();

let sessionSecret: string | undefined;

vi.mock("@/lib/runtime/app-config", () => ({
  getStoredRuntimeFields,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    appConfig: {
      upsert,
    },
  },
}));

vi.mock("@/lib/env", () => ({
  env: {
    get sessionSecret() {
      return sessionSecret;
    },
  },
}));

describe("runtime secret", () => {
  beforeEach(() => {
    sessionSecret = undefined;
    vi.clearAllMocks();
    vi.resetModules();
    getStoredRuntimeFields.mockResolvedValue({
      appUrl: null,
      runtimeSecret: null,
      jellyfinApiKeyEncrypted: null,
      lidarrApiKeyEncrypted: null,
    });
    upsert.mockResolvedValue({});
  });

  it("persists SESSION_SECRET once when no runtime secret is stored", async () => {
    sessionSecret = " env-session-secret ";

    const { getRuntimeSecret } = await import("../lib/runtime/secret");

    await expect(getRuntimeSecret()).resolves.toBe("env-session-secret");
    await expect(getRuntimeSecret()).resolves.toBe("env-session-secret");
    expect(getStoredRuntimeFields).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith({
      where: { id: 1 },
      update: { runtimeSecret: "env-session-secret" },
      create: { id: 1, runtimeSecret: "env-session-secret" },
    });
  });

  it("uses SESSION_SECRET without overwriting an existing stored runtime secret", async () => {
    sessionSecret = " env-session-secret ";
    getStoredRuntimeFields.mockResolvedValue({
      appUrl: null,
      runtimeSecret: "stored-secret",
      jellyfinApiKeyEncrypted: null,
      lidarrApiKeyEncrypted: null,
    });

    const { getRuntimeSecret } = await import("../lib/runtime/secret");

    await expect(getRuntimeSecret()).resolves.toBe("env-session-secret");
    expect(getStoredRuntimeFields).toHaveBeenCalledTimes(1);
    expect(upsert).not.toHaveBeenCalled();
  });
});
