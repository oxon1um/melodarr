import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { NextRequest, NextResponse } from "next/server";
import { requestPinnedUrl, type ResolvedAddress } from "@/lib/http/pinned-request";
import { verifySignedImageParams } from "@/lib/images";
import { getRuntimeConfig } from "@/lib/settings/store";

export const runtime = "nodejs";

const CACHE_CONTROL = "private, max-age=3600, stale-while-revalidate=86400";
const MAX_REDIRECTS = 3;
const INVALID_IMAGE_SOURCE_ERROR = "Invalid image source";
const IMAGE_TIMEOUT_ERROR = "Image request timed out";

type ImageOriginSet = Set<string>;

const createTimeoutError = (): Error & { status: number } =>
  Object.assign(new Error(IMAGE_TIMEOUT_ERROR), { status: 504 });

const withAbortDeadline = async <T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> => {
  if (!signal) {
    return operation;
  }

  if (signal.aborted) {
    throw createTimeoutError();
  }

  return await new Promise<T>((resolve, reject) => {
    const handleAbort = () => reject(createTimeoutError());

    signal.addEventListener("abort", handleAbort, { once: true });
    operation.then(resolve, reject).finally(() => {
      signal.removeEventListener("abort", handleAbort);
    });
  });
};

const normalizeHostname = (hostname: string): string =>
  hostname
    .trim()
    .toLowerCase()
    .replace(/^\[(.*)\]$/, "$1")
    .replace(/\.+$/, "");

const isPrivateIpv4Address = (address: string): boolean => {
  const parts = address.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part))) {
    return false;
  }

  const [first, second] = parts.map((part) => Number.parseInt(part, 10));
  if (first === 0 || first === 10 || first === 127) {
    return true;
  }

  if (first === 169 && second === 254) {
    return true;
  }

  if (first === 172 && second >= 16 && second <= 31) {
    return true;
  }

  if (first === 192 && second === 168) {
    return true;
  }

  return first === 100 && second >= 64 && second <= 127;
};

const parseIpv6HexGroup = (value: string): number | null => {
  if (!/^[\da-f]{1,4}$/i.test(value)) {
    return null;
  }

  return Number.parseInt(value, 16);
};

const expandIpv6Address = (address: string): number[] | null => {
  const normalized = normalizeHostname(address);
  if (normalized.includes(".")) {
    return null;
  }

  const parts = normalized.split("::");
  if (parts.length > 2) {
    return null;
  }

  const left = parts[0]?.split(":").filter(Boolean) ?? [];
  const right = parts[1]?.split(":").filter(Boolean) ?? [];
  const missingGroups = 8 - (left.length + right.length);

  if ((parts.length === 1 && left.length !== 8) || missingGroups < 0) {
    return null;
  }

  const groups = [
    ...left,
    ...Array(parts.length === 2 ? missingGroups : 0).fill("0"),
    ...right,
  ];

  if (groups.length !== 8) {
    return null;
  }

  const parsedGroups = groups.map((group) => parseIpv6HexGroup(group));
  return parsedGroups.every((group) => group !== null) ? parsedGroups : null;
};

const isExpandedIpv6Loopback = (groups: number[]): boolean =>
  groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1;

const isExpandedIpv6Unspecified = (groups: number[]): boolean =>
  groups.every((group) => group === 0);

const extractMappedIpv4Address = (address: string): string | null => {
  const normalized = normalizeHostname(address);
  const dottedQuadMatch = normalized.match(/(?:^|:)ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (dottedQuadMatch) {
    return dottedQuadMatch[1];
  }

  const groups = expandIpv6Address(normalized);
  if (!groups) {
    return null;
  }

  const isMappedIpv4 = groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff;
  if (!isMappedIpv4) {
    return null;
  }

  return [
    groups[6] >> 8,
    groups[6] & 0xff,
    groups[7] >> 8,
    groups[7] & 0xff,
  ].join(".");
};

const isPrivateIpv6Address = (address: string): boolean => {
  const normalized = normalizeHostname(address);
  const expandedGroups = expandIpv6Address(normalized);
  if (expandedGroups && (isExpandedIpv6Unspecified(expandedGroups) || isExpandedIpv6Loopback(expandedGroups))) {
    return true;
  }

  if (
    normalized.startsWith("fe8")
    || normalized.startsWith("fe9")
    || normalized.startsWith("fea")
    || normalized.startsWith("feb")
    || normalized.startsWith("fc")
    || normalized.startsWith("fd")
  ) {
    return true;
  }

  const mappedIpv4Address = extractMappedIpv4Address(normalized);
  return mappedIpv4Address ? isPrivateIpv4Address(mappedIpv4Address) : false;
};

const isUnsafeIpAddress = (address: string): boolean => {
  const normalized = normalizeHostname(address);
  const family = isIP(normalized);

  if (family === 4) {
    return isPrivateIpv4Address(normalized);
  }

  if (family === 6) {
    return isPrivateIpv6Address(normalized);
  }

  return false;
};

const isUnsafeHostname = (hostname: string): boolean => {
  const normalized = normalizeHostname(hostname);
  if (!normalized) {
    return true;
  }

  if (
    normalized === "localhost"
    || normalized.endsWith(".localhost")
  ) {
    return true;
  }

  return isUnsafeIpAddress(normalized);
};

const getOrigin = (value: string | null | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return undefined;
    }

    return url.origin;
  } catch {
    return undefined;
  }
};

const getAllowedPrivateImageOrigins = async (): Promise<ImageOriginSet> => {
  const config = await getRuntimeConfig();

  return new Set(
    [getOrigin(config.lidarrUrl), getOrigin(config.jellyfinUrl)]
      .filter((origin): origin is string => Boolean(origin))
  );
};

const isAllowedPrivateImageOrigin = (url: URL, allowedOrigins: ImageOriginSet): boolean =>
  allowedOrigins.has(url.origin);

const resolveHostnameAddresses = async (
  hostname: string,
  signal?: AbortSignal,
): Promise<ResolvedAddress[]> => {
  const normalized = normalizeHostname(hostname);
  const family = isIP(normalized);
  if (family === 4 || family === 6) {
    return [{ address: normalized, family }];
  }

  const results = await withAbortDeadline(
    lookup(normalized, {
      all: true,
      verbatim: true,
    }),
    signal,
  );

  return results
    .filter((result) => result.family === 4 || result.family === 6)
    .map((result) => ({
      address: normalizeHostname(result.address),
      family: result.family as 4 | 6,
    }));
};

const resolveSafeAddress = async (
  url: URL,
  allowedPrivateOrigins: ImageOriginSet,
  signal?: AbortSignal,
): Promise<ResolvedAddress | null> => {
  const addresses = await resolveHostnameAddresses(url.hostname, signal);
  if (addresses.length === 0) {
    return null;
  }

  if (
    !isAllowedPrivateImageOrigin(url, allowedPrivateOrigins)
    && addresses.some((address) => isUnsafeIpAddress(address.address))
  ) {
    return null;
  }

  return addresses[0];
};

const fetchSafeImageResponse = async (
  initialUrl: URL,
  allowedPrivateOrigins: ImageOriginSet,
  signal?: AbortSignal,
): Promise<{ body: ReadableStream<Uint8Array> | null; headers: Headers; status: number }> => {
  let currentUrl = initialUrl;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    if (isUnsafeHostname(currentUrl.hostname) && !isAllowedPrivateImageOrigin(currentUrl, allowedPrivateOrigins)) {
      throw Object.assign(new Error(INVALID_IMAGE_SOURCE_ERROR), { status: 400 });
    }

    const resolvedAddress = await resolveSafeAddress(currentUrl, allowedPrivateOrigins, signal);
    if (!resolvedAddress) {
      throw Object.assign(new Error(INVALID_IMAGE_SOURCE_ERROR), { status: 400 });
    }

    const response = await requestPinnedUrl(currentUrl, resolvedAddress, signal);
    const location = response.headers.get("location");
    if (response.status < 300 || response.status >= 400 || !location) {
      return response;
    }

    currentUrl = new URL(location, currentUrl);
  }

  throw Object.assign(new Error("Too many image redirects"), { status: 502 });
};

export async function GET(req: NextRequest) {
  try {
    const src = await verifySignedImageParams(req.nextUrl.searchParams);
    if (!src) {
      return NextResponse.json({ error: "Invalid image signature" }, { status: 400 });
    }

    const url = new URL(src);
    const allowedPrivateOrigins = await getAllowedPrivateImageOrigins();
    const timeoutSignal = typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
      ? AbortSignal.timeout(5_000)
      : undefined;
    const response = await fetchSafeImageResponse(url, allowedPrivateOrigins, timeoutSignal);

    if (response.status < 200 || response.status >= 300) {
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
    const message = error instanceof Error && error.message === INVALID_IMAGE_SOURCE_ERROR
      ? INVALID_IMAGE_SOURCE_ERROR
      : "Failed to load image";
    return NextResponse.json({ error: message }, { status });
  }
}
