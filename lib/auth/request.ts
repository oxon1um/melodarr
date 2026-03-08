import { NextRequest } from "next/server";

export const clientIp = (req: NextRequest): string => {
  const forwarded = req.headers.get("x-forwarded-for");
  if (!forwarded) return "unknown";
  return forwarded.split(",")[0]?.trim() || "unknown";
};
