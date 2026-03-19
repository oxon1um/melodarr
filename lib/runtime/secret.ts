import { randomBytes } from "crypto";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { getStoredRuntimeFields } from "@/lib/runtime/app-config";

let cachedSecret: string | null = null;

const saveRuntimeSecret = async (secret: string) => {
  await prisma.appConfig.update({
    where: { id: 1 },
    data: { runtimeSecret: secret }
  });
};

export const getRuntimeSecret = async (): Promise<string> => {
  if (env.sessionSecret?.trim()) {
    const override = env.sessionSecret.trim();
    if (!cachedSecret) {
      cachedSecret = override;
      const stored = await getStoredRuntimeFields();
      if (!stored.runtimeSecret) {
        await saveRuntimeSecret(override);
      }
    }
    return override;
  }

  if (cachedSecret) {
    return cachedSecret;
  }

  const stored = await getStoredRuntimeFields();
  if (stored.runtimeSecret?.trim()) {
    cachedSecret = stored.runtimeSecret.trim();
    return cachedSecret;
  }

  const created = randomBytes(64).toString("hex");
  await saveRuntimeSecret(created);
  cachedSecret = created;
  return created;
};
