import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { enforceLoginRateLimit } from "../lib/auth/login-rate-limit";
import { enforceRateLimit } from "../lib/rate-limit/simple";

vi.mock("@/lib/rate-limit/simple", () => ({
  enforceRateLimit: vi.fn()
}));

const mockedEnforceRateLimit = vi.mocked(enforceRateLimit);

describe("enforceLoginRateLimit", () => {
  it("checks ip, username, and global buckets", async () => {
    mockedEnforceRateLimit.mockResolvedValue({ allowed: true, remaining: 1, retryAfterSec: 60 });

    const request = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "x-forwarded-for": "203.0.113.10" }
    });

    await expect(enforceLoginRateLimit(request, " Admin ")).resolves.toEqual({
      allowed: true,
      retryAfterSec: 0
    });

    expect(mockedEnforceRateLimit).toHaveBeenCalledWith("login:ip:203.0.113.10", {
      max: 10,
      windowSec: 60
    });
    expect(mockedEnforceRateLimit).toHaveBeenCalledWith("login:user:admin", {
      max: 20,
      windowSec: 300
    });
    expect(mockedEnforceRateLimit).toHaveBeenCalledWith("login:global", {
      max: 300,
      windowSec: 60
    });
  });

  it("blocks when any bucket is exhausted", async () => {
    mockedEnforceRateLimit
      .mockResolvedValueOnce({ allowed: true, remaining: 1, retryAfterSec: 60 })
      .mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterSec: 240 })
      .mockResolvedValueOnce({ allowed: true, remaining: 1, retryAfterSec: 60 });

    const request = new NextRequest("http://localhost:3000/api/auth/login", { method: "POST" });

    await expect(enforceLoginRateLimit(request, "admin")).resolves.toEqual({
      allowed: false,
      retryAfterSec: 240
    });
  });
});
