import { User } from "@prisma/client";

import { enforceRateLimit } from "@/lib/rate-limit/simple";

type SearchRateLimitResult = {
  allowed: boolean;
  retryAfterSec: number;
};

export const enforceSearchRateLimit = async (
  user: Pick<User, "id">
): Promise<SearchRateLimitResult> => {
  const limit = await enforceRateLimit(`search:user:${user.id}`, { max: 120, windowSec: 60 });

  return {
    allowed: limit.allowed,
    retryAfterSec: limit.retryAfterSec
  };
};
