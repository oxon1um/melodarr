import { createHash } from "crypto";
import { Role, User } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isAppInitialized } from "@/lib/app-state";
import { prisma } from "@/lib/db/prisma";
import { SESSION_COOKIE } from "@/lib/auth/session";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const getCurrentUser = async (): Promise<User | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findFirst({
    where: {
      tokenHash: hashToken(token),
      expiresAt: {
        gt: new Date()
      }
    },
    include: {
      user: true
    }
  });

  return session?.user ?? null;
};

export const requireCurrentUser = async (): Promise<User> => {
  const user = await getCurrentUser();
  if (!user) {
    const initialized = await isAppInitialized();
    redirect(initialized ? "/login" : "/setup");
  }

  return user;
};

export const requireCurrentAdmin = async (): Promise<User> => {
  const user = await requireCurrentUser();
  if (user.role !== Role.ADMIN) {
    redirect("/discover");
  }

  return user;
};
