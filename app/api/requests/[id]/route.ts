import { RequestStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { approvePendingRequest } from "@/lib/requests/service";

const updateSchema = z.object({
  action: z.enum(["approve", "reject"])
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(req);
    const { id } = await context.params;
    const body = updateSchema.parse(await req.json());

    if (body.action === "reject") {
      const request = await prisma.request.update({
        where: { id },
        data: {
          status: RequestStatus.REJECTED
        }
      });

      return jsonOk({ request });
    }

    const request = await approvePendingRequest(id);
    return jsonOk({ request });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(error.issues[0]?.message ?? "Invalid payload", 400);
    }

    const status = (error as { status?: number }).status ?? 500;
    return jsonError(error instanceof Error ? error.message : "Failed to update request", status);
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(req);
    const { id } = await context.params;

    // Delete the request
    await prisma.request.delete({
      where: { id }
    });

    return jsonOk({ success: true });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return jsonError(error instanceof Error ? error.message : "Failed to delete request", status);
  }
}
