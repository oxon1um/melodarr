import { getEffectiveAppUrl } from "@/lib/runtime/app-config";

type HeaderReader = {
  get(name: string): string | null;
};

const parseForwardedProto = (value: string | null): string | null => {
  if (!value) return null;
  const firstHop = value.split(",")[0]?.trim();
  if (!firstHop) return null;

  const match = firstHop.match(/proto="?([a-zA-Z]+)"?/i);
  return match?.[1]?.toLowerCase() ?? null;
};

const parseSimpleProto = (value: string | null): string | null => {
  if (!value) return null;
  const first = value.split(",")[0]?.trim().toLowerCase();
  return first || null;
};

export const isHttpsRequest = async (headers: HeaderReader): Promise<boolean> => {
  const forwardedProto = parseForwardedProto(headers.get("forwarded"));
  if (forwardedProto) {
    return forwardedProto === "https";
  }

  const xForwardedProto = parseSimpleProto(headers.get("x-forwarded-proto"));
  if (xForwardedProto) {
    return xForwardedProto === "https";
  }

  try {
    return new URL(await getEffectiveAppUrl()).protocol === "https:";
  } catch {
    return false;
  }
};
