import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";

const clearSessionCookie = vi.fn(async (response: NextResponse) => response);
const deleteSessionToken = vi.fn();
const getAuthenticatedUser = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  clearSessionCookie,
  deleteSessionToken,
  getAuthenticatedUser,
  SESSION_COOKIE: "melodarr_session"
}));

describe("auth API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSessionCookie.mockImplementation(async (response: NextResponse) => response);
  });

  it("returns a null user when no session is authenticated", async () => {
    getAuthenticatedUser.mockResolvedValue(null);

    const { GET } = await import("../app/api/auth/me/route");
    const request = new NextRequest("http://localhost:3000/api/auth/me");
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ user: null });
  });

  it("returns the authenticated user's public profile", async () => {
    getAuthenticatedUser.mockResolvedValue({
      id: "user-1",
      username: "admin",
      role: Role.ADMIN,
      passwordHash: "secret"
    });

    const { GET } = await import("../app/api/auth/me/route");
    const request = new NextRequest("http://localhost:3000/api/auth/me");
    const response = await GET(request);
    const payload = await response.json();

    expect(payload).toEqual({
      user: {
        id: "user-1",
        username: "admin",
        role: Role.ADMIN
      }
    });
  });

  it("deletes and clears the session cookie during logout", async () => {
    const { POST } = await import("../app/api/auth/logout/route");
    const request = new NextRequest("http://localhost:3000/api/auth/logout", {
      method: "POST",
      headers: {
        cookie: "melodarr_session=session-token"
      }
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(deleteSessionToken).toHaveBeenCalledWith("session-token");
    expect(clearSessionCookie).toHaveBeenCalledTimes(1);
    expect(payload).toEqual({ ok: true });
  });
});
