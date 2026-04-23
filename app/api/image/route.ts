import { NextRequest, NextResponse } from "next/server";
import { verifySignedImageParams } from "@/lib/images";

const CACHE_CONTROL = "private, max-age=3600, stale-while-revalidate=86400";

const isPrivateIpv4Hostname = (hostname: string): boolean => {
  const parts = hostname.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part))) {
    return false;
  }

  const [first, second] = parts.map((part) => Number.parseInt(part, 10));
  if (first === 10 || first === 127) {
    return true;
  }

  if (first === 169 && second === 254) {
    return true;
  }

  if (first === 172 && second >= 16 && second <= 31) {
    return true;
  }

  return first === 192 && second === 168;
};

const isUnsafeHostname = (hostname: string): boolean => {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  if (
    normalized === "localhost"
    || normalized.endsWith(".localhost")
    || normalized === "::1"
    || normalized.startsWith("[::1")
    || normalized.startsWith("fe80:")
    || normalized.startsWith("fc")
    || normalized.startsWith("fd")
  ) {
    return true;
  }

  return isPrivateIpv4Hostname(normalized);
};

export async function GET(req: NextRequest) {
  try {
    const src = await verifySignedImageParams(req.nextUrl.searchParams);
    if (!src) {
      return NextResponse.json({ error: "Invalid image signature" }, { status: 400 });
    }

    const url = new URL(src);
    if (isUnsafeHostname(url.hostname)) {
      return NextResponse.json({ error: "Invalid image source" }, { status: 400 });
    }

    const timeoutSignal = typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
      ? AbortSignal.timeout(5_000)
      : undefined;
    const response = await fetch(src, timeoutSignal ? { signal: timeoutSignal } : undefined);

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch image" }, { status: response.status });
    }

    const contentType = response.headers.get("content-type");
    if (!contentType?.toLowerCase().startsWith("image/")) {
      return NextResponse.json({ error: "Invalid upstream image response" }, { status: 415 });
    }

    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Cache-Control", CACHE_CONTROL);

    return new NextResponse(response.body, {
      status: 200,
      headers
    });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load image" },
      { status }
    );
  }
}
