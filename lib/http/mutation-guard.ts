import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/http";
import { getEffectiveAppUrl } from "@/lib/runtime/app-config";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const getOrigin = (value: string | null): string | null => {
  if (!value) return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

const getAllowedOrigin = async (): Promise<string> => {
  try {
    return new URL(await getEffectiveAppUrl()).origin;
  } catch {
    return new URL("http://localhost:3000").origin;
  }
};

export const validateMutationRequest = async (
  req: Pick<NextRequest, "headers" | "method">
): Promise<NextResponse | null> => {
  if (!UNSAFE_METHODS.has(req.method.toUpperCase())) return null;

  const fetchSite = req.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite === "cross-site") {
    return jsonError("Cross-site mutation requests are not allowed", 403);
  }

  const requestOrigin = getOrigin(req.headers.get("origin"));
  if (!requestOrigin) return null;

  const allowedOrigin = await getAllowedOrigin();
  if (requestOrigin !== allowedOrigin) {
    return jsonError("Request origin is not allowed", 403);
  }

  return null;
};
