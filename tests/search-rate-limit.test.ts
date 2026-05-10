import { describe, expect, it, vi } from "vitest";

import { enforceRateLimit } from "../lib/rate-limit/simple";
import { enforceSearchRateLimit } from "../lib/search/rate-limit";

vi.mock("@/lib/rate-limit/simple", () => ({
  enforceRateLimit: vi.fn()
}));

const mockedEnforceRateLimit = vi.mocked(enforceRateLimit);

describe("enforceSearchRateLimit", () => {
  it("uses a generous per-user bucket", async () => {
    mockedEnforceRateLimit.mockResolvedValue({ allowed: true, remaining: 119, retryAfterSec: 60 });

    await expect(enforceSearchRateLimit({ id: "user-1" })).resolves.toEqual({
      allowed: true,
      retryAfterSec: 60
    });

    expect(mockedEnforceRateLimit).toHaveBeenCalledWith("search:user:user-1", {
      max: 120,
      windowSec: 60
    });
  });
});
