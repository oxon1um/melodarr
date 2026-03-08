import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { jsonOk } from "@/lib/http";

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);

  if (!user) {
    return jsonOk({ user: null });
  }

  return jsonOk({
    user: {
      id: user.id,
      username: user.username,
      role: user.role
    }
  });
}
