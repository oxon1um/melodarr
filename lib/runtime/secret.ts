import { randomBytes } from "crypto";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { getStoredRuntimeFields } from "@/lib/runtime/app-config";

let cachedSecret: string | null = null;

const saveRuntimeSecret = async (secret: string) => {
  await prisma.appConfig.upsert({
    where: { id: 1 },
    update: { runtimeSecret: secret },
    create: { id: 1, runtimeSecret: secret }
  });
};

export const getRuntimeSecret = async (): Promise<string> => {
  const envSecret = env.sessionSecret?.trim();
  if (envSecret) {
    const override = envSecret;
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
  const storedSecret = stored.runtimeSecret?.trim();
  if (storedSecret) {
    cachedSecret = storedSecret;
    return cachedSecret;
  }

  const created = randomBytes(64).toString("hex");
  await saveRuntimeSecret(created);
  cachedSecret = created;
  return created;
};
