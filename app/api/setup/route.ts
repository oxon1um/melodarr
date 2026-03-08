import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAppInitialized } from "@/lib/app-state";
import { hashPassword } from "@/lib/auth/password";
import { attachSessionCookie, createSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { jsonError } from "@/lib/http";
import { getRuntimeSecret } from "@/lib/runtime/secret";

const setupSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(8)
});

export async function POST(req: NextRequest) {
  try {
    const initialized = await isAppInitialized();
    if (initialized) {
      return jsonError("Setup has already been completed", 409);
    }

    const payload = setupSchema.parse(await req.json());

    const passwordHash = await hashPassword(payload.password);

    const user = await prisma.$transaction(async (tx) => {
      const existingUsers = await tx.user.count();
      if (existingUsers > 0) {
        throw new Error("Setup has already been completed");
      }

      const createdUser = await tx.user.create({
        data: {
          username: payload.username,
          passwordHash,
          role: Role.ADMIN
        }
      });

      return createdUser;
    });

    await getRuntimeSecret();

    const session = await createSession(user.id);
    const response = NextResponse.json({ ok: true });
    return await attachSessionCookie(response, session.token, session.expiresAt);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(error.issues[0]?.message ?? "Invalid setup payload", 400);
    }

    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return jsonError("Username is already in use", 409);
    }

    if (error instanceof Error && error.message === "Setup has already been completed") {
      return jsonError(error.message, 409);
    }

    return jsonError(error instanceof Error ? error.message : "Setup failed", 500);
  }
}
