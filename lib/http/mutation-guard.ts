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

const getFirstHeaderValue = (value: string | null): string | null => {
  const first = value?.split(",")[0]?.trim();
  return first || null;
};

const getHeaderOrigin = (input: {
  protocol: string | null;
  host: string | null;
}): string | null => {
  const protocol = getFirstHeaderValue(input.protocol)?.replace(/:$/, "").toLowerCase();
  const host = getFirstHeaderValue(input.host);
  if (!protocol || !host) return null;

  try {
    return new URL(`${protocol}://${host}`).origin;
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

const getRequestUrlOrigin = (url: string): string | null => {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
};

const getRequestOriginProtocol = (origin: string): string | null => {
  try {
    return new URL(origin).protocol.replace(/:$/, "");
  } catch {
    return null;
  }
};

const getHeaderOrigins = (headers: Headers, requestOrigin: string): string[] => {
  const requestProtocol = getRequestOriginProtocol(requestOrigin);
  const forwardedProto = headers.get("x-forwarded-proto");
  const forwardedHost = headers.get("x-forwarded-host");
  const host = headers.get("host");

  return [
    getHeaderOrigin({ protocol: forwardedProto, host: forwardedHost }),
    getHeaderOrigin({ protocol: forwardedProto, host }),
    getHeaderOrigin({ protocol: requestProtocol, host: forwardedHost }),
    getHeaderOrigin({ protocol: requestProtocol, host })
  ].filter((origin): origin is string => Boolean(origin));
};

export const validateMutationRequest = async (
  req: Pick<NextRequest, "headers" | "method" | "url">
): Promise<NextResponse | null> => {
  if (!UNSAFE_METHODS.has(req.method.toUpperCase())) return null;

  const fetchSite = req.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite === "cross-site") {
    return jsonError("Cross-site mutation requests are not allowed", 403);
  }

  const requestOrigin = getOrigin(req.headers.get("origin"));
  if (!requestOrigin) return null;

  const allowedOrigins = new Set([
    await getAllowedOrigin(),
    getRequestUrlOrigin(req.url),
    ...getHeaderOrigins(req.headers, requestOrigin)
  ].filter((origin): origin is string => Boolean(origin)));

  if (!allowedOrigins.has(requestOrigin)) {
    return jsonError("Request origin is not allowed", 403);
  }

  return null;
};
