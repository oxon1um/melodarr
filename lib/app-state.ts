import { prisma } from "@/lib/db/prisma";

export const isAppInitialized = async (): Promise<boolean> => {
  const userCount = await prisma.user.count();
  return userCount > 0;
};
