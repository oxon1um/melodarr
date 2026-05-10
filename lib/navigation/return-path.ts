const APP_RELATIVE_PATH_PATTERN = /^\/[A-Za-z0-9._~!$&'()*+,;=:@/%?-]*$/;
const SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:/;

export const getSafeReturnPath = (value: string | null | undefined, fallback = "/discover"): string => {
  if (!value) return fallback;

  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
  if (SCHEME_PATTERN.test(trimmed)) return fallback;
  if (!APP_RELATIVE_PATH_PATTERN.test(trimmed)) return fallback;

  return trimmed;
};
