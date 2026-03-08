import { RequestStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { createAlbumRequest, createArtistRequest } from "@/lib/requests/service";

const createRequestSchema = z.object({
  requestType: z.enum(["artist", "album"]).optional(),
  artistName: z.string().min(1),
  albumTitle: z.string().min(1).optional(),
  foreignAlbumId: z.string().optional(),
  foreignArtistId: z.string().optional(),
  mbid: z.string().optional()
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const statusFilter = req.nextUrl.searchParams.get("status") as RequestStatus | null;

    const requests = await prisma.request.findMany({
      where: {
        ...(user.role === "ADMIN" ? {} : { requestedById: user.id }),
        ...(statusFilter ? { status: statusFilter } : {})
      },
      include: {
        requestedBy: {
          select: {
            username: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 200
    });

    return jsonOk({ requests });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return jsonError(error instanceof Error ? error.message : "Failed to load requests", status);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const payload = createRequestSchema.parse(await req.json());

    if (payload.requestType === "album" || payload.albumTitle) {
      if (!payload.albumTitle) {
        return jsonError("albumTitle is required for album requests", 400);
      }

      const result = await createAlbumRequest({
        requestedById: user.id,
        artistName: payload.artistName,
        albumTitle: payload.albumTitle,
        foreignAlbumId: payload.foreignAlbumId,
        foreignArtistId: payload.foreignArtistId
      });

      return jsonOk(result);
    }

    const result = await createArtistRequest({
      requestedById: user.id,
      artistName: payload.artistName,
      foreignArtistId: payload.foreignArtistId,
      mbid: payload.mbid
    });

    return jsonOk(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(error.issues[0]?.message ?? "Invalid payload", 400);
    }

    const status = (error as { status?: number }).status ?? 500;
    return jsonError(error instanceof Error ? error.message : "Failed to create request", status);
  }
}
