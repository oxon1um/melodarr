import { RequestStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import {
  createAlbumRequest,
  createArtistRequest,
  syncSubmittedAlbumRequestsIfStale,
} from "@/lib/requests/service";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

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

    try {
      await syncSubmittedAlbumRequestsIfStale();
    } catch {
      // Keep request listings available even when sync cannot run.
    }

    const statusFilterRaw = req.nextUrl.searchParams.get("status");
    const cursor = req.nextUrl.searchParams.get("cursor") || undefined;
    const limitRaw = Number.parseInt(req.nextUrl.searchParams.get("limit") ?? "", 10);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;
    const statusFilter = statusFilterRaw && Object.values(RequestStatus).includes(statusFilterRaw as RequestStatus)
      ? (statusFilterRaw as RequestStatus)
      : null;

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
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" }
      ],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: limit + 1
    });

    const hasMore = requests.length > limit;
    const page = hasMore ? requests.slice(0, limit) : requests;
    const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

    return jsonOk({
      requests: page,
      nextCursor,
      hasMore
    });
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
