import { User } from "@prisma/client";

import { enforceRateLimit } from "@/lib/rate-limit/simple";

export const shouldRunRequestListSync = async (user: Pick<User, "id">): Promise<boolean> => {
  const [userLimit, globalLimit] = await Promise.all([
    enforceRateLimit(`requests:sync:user:${user.id}`, { max: 6, windowSec: 60 }),
    enforceRateLimit("requests:sync:global", { max: 30, windowSec: 60 })
  ]);

  return userLimit.allowed && globalLimit.allowed;
};
