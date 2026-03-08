import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";

const DEFAULT_APP_URL = "http://localhost:3000";

export const ensureAppConfig = async () => {
  return prisma.appConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 }
  });
};

export const getStoredRuntimeFields = async () => {
  await ensureAppConfig();

  return prisma.appConfig.findUniqueOrThrow({
    where: { id: 1 },
    select: {
      appUrl: true,
      runtimeSecret: true,
      jellyfinApiKeyEncrypted: true,
      lidarrApiKeyEncrypted: true
    }
  });
};

export const getEffectiveAppUrl = async (): Promise<string> => {
  const stored = await getStoredRuntimeFields();
  if (stored.appUrl?.trim()) {
    return stored.appUrl.trim();
  }

  if (env.appUrl?.trim()) {
    return env.appUrl.trim();
  }

  return DEFAULT_APP_URL;
};
