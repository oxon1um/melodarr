import { NextRequest, NextResponse } from "next/server";
import { verifySignedImageParams } from "@/lib/images";

const CACHE_CONTROL = "private, max-age=3600, stale-while-revalidate=86400";

export async function GET(req: NextRequest) {
  try {
    const src = await verifySignedImageParams(req.nextUrl.searchParams);
    if (!src) {
      return NextResponse.json({ error: "Invalid image signature" }, { status: 400 });
    }

    const timeoutSignal = typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
      ? AbortSignal.timeout(5_000)
      : undefined;
    const response = await fetch(src, timeoutSignal ? { signal: timeoutSignal } : undefined);

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch image" }, { status: response.status });
    }

    const headers = new Headers();
    const contentType = response.headers.get("content-type");
    if (contentType) {
      headers.set("Content-Type", contentType);
    }
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
