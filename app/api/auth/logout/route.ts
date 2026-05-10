import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, deleteSessionToken, SESSION_COOKIE } from "@/lib/auth/session";
import { validateMutationRequest } from "@/lib/http/mutation-guard";

export async function POST(req: NextRequest) {
  const blocked = await validateMutationRequest(req);
  if (blocked) return blocked;

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  await deleteSessionToken(token);

  const response = NextResponse.json({ ok: true });
  return await clearSessionCookie(response);
}
