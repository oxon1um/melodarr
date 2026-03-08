import { createHash, randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { Role, User } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { isProduction } from "@/lib/env";
import { getEffectiveAppUrl } from "@/lib/runtime/app-config";

export const SESSION_COOKIE = "melodarr_session";
const SESSION_TTL_DAYS = 14;

const shouldUseSecureCookies = async (): Promise<boolean> => {
  if (!isProduction) return false;

  try {
    return new URL(await getEffectiveAppUrl()).protocol === "https:";
  } catch {
    return true;
  }
};

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const createSession = async (userId: string) => {
  const token = randomBytes(48).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt
    }
  });

  return { token, expiresAt };
};

export const attachSessionCookie = async (
  response: NextResponse,
  token: string,
  expiresAt: Date
): Promise<NextResponse> => {
  const secure = await shouldUseSecureCookies();
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    expires: expiresAt
  });

  return response;
};

export const clearSessionCookie = async (response: NextResponse): Promise<NextResponse> => {
  const secure = await shouldUseSecureCookies();
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    expires: new Date(0)
  });

  return response;
};

export const deleteSessionToken = async (token: string | undefined) => {
  if (!token) return;

  await prisma.session.deleteMany({
    where: {
      tokenHash: hashToken(token)
    }
  });
};

export const getAuthenticatedUser = async (req: NextRequest): Promise<User | null> => {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const now = new Date();
  const session = await prisma.session.findFirst({
    where: {
      tokenHash: hashToken(token),
      expiresAt: { gt: now }
    },
    include: {
      user: true
    }
  });

  return session?.user ?? null;
};

export const requireUser = async (req: NextRequest): Promise<User> => {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }

  return user;
};

export const requireAdmin = async (req: NextRequest): Promise<User> => {
  const user = await requireUser(req);
  if (user.role !== Role.ADMIN) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }

  return user;
};
