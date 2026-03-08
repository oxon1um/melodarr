import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAppInitialized } from "@/lib/app-state";
import { createSession, attachSessionCookie } from "@/lib/auth/session";
import { clientIp } from "@/lib/auth/request";
import { verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";
import { jsonError } from "@/lib/http";
import { isHttpsRequest } from "@/lib/http/protocol";
import { authenticateWithJellyfin } from "@/lib/jellyfin/client";
import { enforceRateLimit } from "@/lib/rate-limit/simple";
import { getRuntimeSecret } from "@/lib/runtime/secret";
import { getRuntimeConfig } from "@/lib/settings/store";

const loginSchema = z.object({
  provider: z.enum(["local", "jellyfin"]).optional(),
  username: z.string().min(1),
  password: z.string().min(1)
});

const ensureUniqueUsername = async (preferredUsername: string, excludeUserId?: string) => {
  const base = preferredUsername.trim() || "jellyfin-user";

  for (let index = 0; index < 100; index += 1) {
    const candidate = index === 0 ? base : `${base}-${index + 1}`;
    const existing = await prisma.user.findUnique({
      where: { username: candidate },
      select: { id: true }
    });

    if (!existing || existing.id === excludeUserId) {
      return candidate;
    }
  }

  throw new Error("Could not generate a unique username");
};

const upsertJellyfinUser = async (input: { userId: string; username: string }) => {
  const existing = await prisma.user.findUnique({
    where: { jellyfinUserId: input.userId },
    select: { id: true, username: true, role: true }
  });

  const username = await ensureUniqueUsername(input.username, existing?.id);

  if (!existing) {
    return prisma.user.create({
      data: {
        jellyfinUserId: input.userId,
        username,
        role: Role.USER,
        lastLoginAt: new Date()
      }
    });
  }

  return prisma.user.update({
    where: { id: existing.id },
    data: {
      username,
      lastLoginAt: new Date()
    }
  });
};

export async function POST(req: NextRequest) {
  try {
    const initialized = await isAppInitialized();
    if (!initialized) {
      return jsonError("Setup is required before sign in", 409);
    }

    await getRuntimeSecret();

    const ip = clientIp(req);
    const limit = await enforceRateLimit(`login:${ip}`, { max: 10, windowSec: 60 });
    if (!limit.allowed) {
      return jsonError(`Too many login attempts. Retry in ${limit.retryAfterSec}s`, 429);
    }

    const body = loginSchema.parse(await req.json());
    const provider = body.provider ?? "local";

    if (provider === "jellyfin") {
      if (!(await isHttpsRequest(req.headers))) {
        return jsonError("Jellyfin sign-in requires HTTPS", 400);
      }

      const config = await getRuntimeConfig();
      if (!config.jellyfinUrl) {
        return jsonError("Jellyfin login is not available yet. Configure Jellyfin in Settings.", 503);
      }

      const authResult = await authenticateWithJellyfin(
        config.jellyfinUrl,
        body.username,
        body.password
      );

      const user = await upsertJellyfinUser({
        userId: authResult.userId,
        username: authResult.username
      });

      const session = await createSession(user.id);
      const response = NextResponse.json({
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      });

      return await attachSessionCookie(response, session.token, session.expiresAt);
    }

    const user = await prisma.user.findUnique({
      where: {
        username: body.username
      }
    });

    if (!user?.passwordHash) {
      return jsonError("Invalid username or password", 401);
    }

    const valid = await verifyPassword(body.password, user.passwordHash);
    if (!valid) {
      return jsonError("Invalid username or password", 401);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    const session = await createSession(user.id);
    const response = NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });

    return await attachSessionCookie(response, session.token, session.expiresAt);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(error.issues[0]?.message ?? "Invalid payload", 400);
    }

    if (error instanceof Error && error.message === "Invalid Jellyfin credentials") {
      return jsonError("Invalid username or password", 401);
    }

    return jsonError(error instanceof Error ? error.message : "Login failed", 500);
  }
}
