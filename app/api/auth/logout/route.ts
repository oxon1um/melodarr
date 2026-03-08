import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, deleteSessionToken, SESSION_COOKIE } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  await deleteSessionToken(token);

  const response = NextResponse.json({ ok: true });
  return await clearSessionCookie(response);
}
