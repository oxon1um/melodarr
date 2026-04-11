import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Role } from "@prisma/client";

const findMany = vi.fn();
const requireUser = vi.fn();
const syncSubmittedAlbumRequestsIfStale = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    request: {
      findMany
    }
  }
}));

vi.mock("@/lib/auth/session", () => ({
  requireUser
}));

vi.mock("@/lib/requests/service", () => ({
  syncSubmittedAlbumRequestsIfStale
}));

describe("GET /api/requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns paginated requests with nextCursor and hasMore", async () => {
    requireUser.mockResolvedValue({ id: "admin-1", role: Role.ADMIN });
    syncSubmittedAlbumRequestsIfStale.mockResolvedValue([]);
    findMany.mockResolvedValue([
      { id: "req-3", artistName: "Artist 3", status: "PENDING", createdAt: "2026-03-12T12:00:00.000Z" },
      { id: "req-2", artistName: "Artist 2", status: "PENDING", createdAt: "2026-03-12T11:00:00.000Z" },
      { id: "req-1", artistName: "Artist 1", status: "PENDING", createdAt: "2026-03-12T10:00:00.000Z" }
    ]);

    const { GET } = await import("../app/api/requests/route");
    const request = new NextRequest("http://localhost:3000/api/requests?limit=2");
    const response = await GET(request);
    const payload = await response.json();

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 3
    }));
    expect(syncSubmittedAlbumRequestsIfStale).toHaveBeenCalledTimes(1);
    expect(payload).toEqual({
      requests: [
        { id: "req-3", artistName: "Artist 3", status: "PENDING", createdAt: "2026-03-12T12:00:00.000Z" },
        { id: "req-2", artistName: "Artist 2", status: "PENDING", createdAt: "2026-03-12T11:00:00.000Z" }
      ],
      nextCursor: "req-2",
      hasMore: true
    });
  });

  it("applies the user filter and cursor for non-admins", async () => {
    requireUser.mockResolvedValue({ id: "user-1", role: Role.USER });
    syncSubmittedAlbumRequestsIfStale.mockResolvedValue([]);
    findMany.mockResolvedValue([
      { id: "req-2", artistName: "Artist 2", status: "APPROVED", createdAt: "2026-03-12T11:00:00.000Z" }
    ]);

    const { GET } = await import("../app/api/requests/route");
    const request = new NextRequest("http://localhost:3000/api/requests?cursor=req-3&limit=500");
    await GET(request);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { requestedById: "user-1" },
      cursor: { id: "req-3" },
      skip: 1,
      take: 101
    }));
  });

  it("still returns requests when sync fails", async () => {
    requireUser.mockResolvedValue({ id: "admin-1", role: Role.ADMIN });
    syncSubmittedAlbumRequestsIfStale.mockRejectedValue(new Error("sync failed"));
    findMany.mockResolvedValue([
      { id: "req-1", artistName: "Artist 1", status: "PENDING", createdAt: "2026-03-12T10:00:00.000Z" }
    ]);

    const { GET } = await import("../app/api/requests/route");
    const request = new NextRequest("http://localhost:3000/api/requests");
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(payload).toEqual({
      requests: [
        { id: "req-1", artistName: "Artist 1", status: "PENDING", createdAt: "2026-03-12T10:00:00.000Z" }
      ],
      nextCursor: null,
      hasMore: false
    });
  });
});
