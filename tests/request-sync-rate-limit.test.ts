import { describe, expect, it, vi } from "vitest";

import { enforceRateLimit } from "../lib/rate-limit/simple";
import { shouldRunRequestListSync } from "../lib/requests/sync-rate-limit";

vi.mock("@/lib/rate-limit/simple", () => ({
  enforceRateLimit: vi.fn()
}));

const mockedEnforceRateLimit = vi.mocked(enforceRateLimit);

describe("shouldRunRequestListSync", () => {
  it("allows sync when user and global buckets allow it", async () => {
    mockedEnforceRateLimit.mockResolvedValue({ allowed: true, remaining: 1, retryAfterSec: 60 });

    await expect(shouldRunRequestListSync({ id: "user-1" })).resolves.toBe(true);
    expect(mockedEnforceRateLimit).toHaveBeenCalledWith("requests:sync:user:user-1", {
      max: 6,
      windowSec: 60
    });
    expect(mockedEnforceRateLimit).toHaveBeenCalledWith("requests:sync:global", {
      max: 30,
      windowSec: 60
    });
  });

  it("skips sync when any bucket is exhausted", async () => {
    mockedEnforceRateLimit
      .mockResolvedValueOnce({ allowed: true, remaining: 1, retryAfterSec: 60 })
      .mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterSec: 60 });

    await expect(shouldRunRequestListSync({ id: "user-1" })).resolves.toBe(false);
  });
});
