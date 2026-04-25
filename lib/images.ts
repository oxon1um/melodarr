import { createHmac, timingSafeEqual } from "crypto";
import { getRuntimeSecret } from "@/lib/runtime/secret";
import type { ImageAsset } from "@/lib/image-selection";

const IMAGE_ROUTE_PATH = "/api/image";
const IMAGE_URL_TTL_SEC = 24 * 60 * 60;

const normalizeSource = (value?: string): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return undefined;
    }

    return parsed.toString();
  } catch {
    return undefined;
  }
};

const encodeSignature = (value: Buffer) =>
  value
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const decodeSignature = (value: string): Buffer => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, "base64");
};

const createImageSignature = (src: string, expiresAt: number, secret: string) =>
  encodeSignature(
    createHmac("sha256", secret)
      .update(`${src}:${expiresAt}`)
      .digest()
  );

export const buildSignedImageUrl = async (src?: string): Promise<string | undefined> => {
  const normalized = normalizeSource(src);
  if (!normalized) {
    return undefined;
  }

  const secret = await getRuntimeSecret();
  const expiresAt = Math.floor(Date.now() / 1000) + IMAGE_URL_TTL_SEC;
  const signature = createImageSignature(normalized, expiresAt, secret);
  const params = new URLSearchParams({
    src: normalized,
    exp: String(expiresAt),
    sig: signature
  });

  return `${IMAGE_ROUTE_PATH}?${params.toString()}`;
};

export const verifySignedImageParams = async (params: URLSearchParams): Promise<string | null> => {
  const src = normalizeSource(params.get("src") ?? undefined);
  const signature = params.get("sig") ?? "";
  const expiresAtRaw = params.get("exp") ?? "";
  const expiresAt = Number.parseInt(expiresAtRaw, 10);

  if (!src || !signature || !Number.isFinite(expiresAt)) {
    return null;
  }

  if (expiresAt < Math.floor(Date.now() / 1000)) {
    return null;
  }

  const secret = await getRuntimeSecret();

  try {
    const expectedDecoded = decodeSignature(createImageSignature(src, expiresAt, secret));
    const actualDecoded = decodeSignature(signature);

    if (expectedDecoded.length !== actualDecoded.length) {
      return null;
    }

    return timingSafeEqual(expectedDecoded, actualDecoded) ? src : null;
  } catch {
    return null;
  }
};

export const withOptimizedImageUrls = async <T extends { images?: ImageAsset[] }>(value: T): Promise<T> => {
  if (!Array.isArray(value.images) || value.images.length === 0) {
    return value;
  }

  const optimizedImages = await Promise.all(
    value.images.map(async (image) => ({
      ...image,
      optimizedUrl: await buildSignedImageUrl(image.url ?? image.remoteUrl)
    }))
  );

  return {
    ...value,
    images: optimizedImages
  };
};

export const withOptimizedImageUrlsForMany = async <T extends { images?: ImageAsset[] }>(values: T[]): Promise<T[]> =>
  Promise.all(values.map((value) => withOptimizedImageUrls(value)));
