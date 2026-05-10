import { NextRequest } from "next/server";

import { clientIp } from "@/lib/auth/request";
import { enforceRateLimit } from "@/lib/rate-limit/simple";

const normalizeUsername = (username: string): string => username.trim().toLowerCase() || "unknown";

type LoginRateLimitResult = {
  allowed: boolean;
  retryAfterSec: number;
};

export const enforceLoginRateLimit = async (
  req: NextRequest,
  username: string
): Promise<LoginRateLimitResult> => {
  const normalizedUsername = normalizeUsername(username);
  const ip = clientIp(req);

  const [ipLimit, usernameLimit, globalLimit] = await Promise.all([
    enforceRateLimit(`login:ip:${ip}`, { max: 10, windowSec: 60 }),
    enforceRateLimit(`login:user:${normalizedUsername}`, { max: 20, windowSec: 300 }),
    enforceRateLimit("login:global", { max: 300, windowSec: 60 })
  ]);

  const blocked = [ipLimit, usernameLimit, globalLimit].filter((limit) => !limit.allowed);
  if (blocked.length === 0) {
    return { allowed: true, retryAfterSec: 0 };
  }

  return {
    allowed: false,
    retryAfterSec: Math.max(...blocked.map((limit) => limit.retryAfterSec))
  };
};
