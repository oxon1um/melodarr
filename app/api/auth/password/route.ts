import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  attachSessionCookie,
  createSession,
  requireAdmin,
  requireUser
} from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { jsonError, jsonOk } from "@/lib/http";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8)
});

const resetPasswordSchema = z.object({
  username: z.string().min(1),
  newPassword: z.string().min(8)
});

const canManageLocalPasswords = async (userId: string): Promise<boolean> => {
  const [self, bootstrapAdmin] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true }
    }),
    prisma.user.findFirst({
      where: { role: "ADMIN" },
      orderBy: { createdAt: "asc" },
      select: { id: true }
    })
  ]);

  return Boolean(self?.passwordHash) && Boolean(bootstrapAdmin?.id === userId);
};

export async function PUT(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const allowed = await canManageLocalPasswords(user.id);
    if (!allowed) {
      return jsonError("Only the setup local admin can change local passwords", 403);
    }

    const body = changePasswordSchema.parse(await req.json());

    if (body.currentPassword === body.newPassword) {
      return jsonError("New password must be different from current password", 400);
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, passwordHash: true }
    });

    if (!dbUser?.passwordHash) {
      return jsonError("This account does not use local password authentication", 400);
    }

    const valid = await verifyPassword(body.currentPassword, dbUser.passwordHash);
    if (!valid) {
      return jsonError("Current password is incorrect", 401);
    }

    const passwordHash = await hashPassword(body.newPassword);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash }
      });

      await tx.session.deleteMany({
        where: { userId: user.id }
      });
    });

    const session = await createSession(user.id);
    const response = jsonOk({ ok: true });
    return await attachSessionCookie(response, session.token, session.expiresAt);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(error.issues[0]?.message ?? "Invalid payload", 400);
    }

    const status = (error as { status?: number }).status ?? 500;
    return jsonError(error instanceof Error ? error.message : "Password update failed", status);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireAdmin(req);
    const allowed = await canManageLocalPasswords(actor.id);
    if (!allowed) {
      return jsonError("Only the setup local admin can reset local passwords", 403);
    }

    const body = resetPasswordSchema.parse(await req.json());

    const targetUser = await prisma.user.findUnique({
      where: { username: body.username },
      select: { id: true, username: true }
    });

    if (!targetUser) {
      return jsonError("User not found", 404);
    }

    const passwordHash = await hashPassword(body.newPassword);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: targetUser.id },
        data: { passwordHash }
      });

      await tx.session.deleteMany({
        where: { userId: targetUser.id }
      });
    });

    if (targetUser.id === actor.id) {
      const session = await createSession(actor.id);
      const response = NextResponse.json({ ok: true, username: targetUser.username });
      return await attachSessionCookie(response, session.token, session.expiresAt);
    }

    return jsonOk({ ok: true, username: targetUser.username });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(error.issues[0]?.message ?? "Invalid payload", 400);
    }

    const status = (error as { status?: number }).status ?? 500;
    return jsonError(error instanceof Error ? error.message : "Password reset failed", status);
  }
}
