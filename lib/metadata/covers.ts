import { fromJsonCache } from "@/lib/cache/json-cache";
import type { LidarrImage } from "@/lib/lidarr/client";

type CoverProvider = "cover-art-archive" | "itunes";

export type CoverFallbackInput = {
  foreignAlbumId?: string;
  artistName?: string;
  albumTitle?: string;
  releaseDate?: string;
};

type CoverCandidate = LidarrImage & {
  source: CoverProvider;
};

type FetchJson = <T>(url: string) => Promise<T | null>;

const COVER_CACHE_NAMESPACE = "metadata:covers";
const COVER_CACHE_TTL_MS = 7 * 24 * 60 * 60_000;
const ITUNES_COUNTRY = "US";

const normalizeText = (value?: string): string | undefined => {
  const normalized = value
    ?.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  return normalized && normalized.length > 0 ? normalized : undefined;
};

const releaseYear = (value?: string): number | undefined => {
  const match = value?.match(/^(\d{4})/);
  if (!match) {
    return undefined;
  }

  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const isHttpUrl = (value: unknown): value is string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return false;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const toHighResolutionItunesArtwork = (value: string): string =>
  value.replace(/\/\d+x\d+(bb)?(-\d+)?\.(jpg|png|webp)$/i, "/1200x1200bb.$3");

const firstUrl = (...values: unknown[]): string | undefined =>
  values.find((value): value is string => isHttpUrl(value));

const defaultFetchJson: FetchJson = async <T>(url: string): Promise<T | null> => {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Melodarr/1.0 (metadata cover fallback)"
      },
      signal: typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
        ? AbortSignal.timeout(2_500)
        : undefined
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
};

type CoverArtArchiveImage = {
  front?: boolean;
  approved?: boolean;
  image?: string;
  thumbnails?: Record<string, string | undefined>;
  types?: string[];
};

type CoverArtArchiveResponse = {
  images?: CoverArtArchiveImage[];
};

const isFrontCover = (image: CoverArtArchiveImage): boolean =>
  image.front === true || (image.types ?? []).some((type) => normalizeText(type) === "front");

const coverArtArchiveImageUrl = (image: CoverArtArchiveImage): string | undefined =>
  firstUrl(image.thumbnails?.["1200"], image.thumbnails?.["500"], image.image);

const getCoverArtArchiveCandidates = async (
  foreignAlbumId: string,
  fetchJson: FetchJson = defaultFetchJson
): Promise<CoverCandidate[]> => {
  const payload = await fetchJson<CoverArtArchiveResponse>(
    `https://coverartarchive.org/release-group/${encodeURIComponent(foreignAlbumId)}`
  );

  const images = payload?.images ?? [];
  const ranked = [...images].sort((left, right) => {
    const leftFront = isFrontCover(left) ? 1 : 0;
    const rightFront = isFrontCover(right) ? 1 : 0;
    const leftApproved = left.approved === false ? 0 : 1;
    const rightApproved = right.approved === false ? 0 : 1;
    return rightFront - leftFront || rightApproved - leftApproved;
  });

  return ranked
    .map((image) => coverArtArchiveImageUrl(image))
    .filter((url): url is string => Boolean(url))
    .slice(0, 3)
    .map((remoteUrl) => ({
      coverType: "cover",
      remoteUrl,
      source: "cover-art-archive"
    }));
};

type ItunesSearchResponse = {
  results?: ItunesAlbumResult[];
};

type ItunesAlbumResult = {
  wrapperType?: string;
  collectionType?: string;
  artistName?: string;
  collectionName?: string;
  releaseDate?: string;
  artworkUrl100?: string;
};

const isStrictItunesMatch = (result: ItunesAlbumResult, input: CoverFallbackInput): boolean => {
  const artist = normalizeText(input.artistName);
  const album = normalizeText(input.albumTitle);
  const resultArtist = normalizeText(result.artistName);
  const resultAlbum = normalizeText(result.collectionName);

  if (!artist || !album || artist !== resultArtist || album !== resultAlbum) {
    return false;
  }

  const expectedYear = releaseYear(input.releaseDate);
  const actualYear = releaseYear(result.releaseDate);

  return !expectedYear || !actualYear || expectedYear === actualYear;
};

const getItunesCandidates = async (
  input: CoverFallbackInput,
  fetchJson: FetchJson = defaultFetchJson
): Promise<CoverCandidate[]> => {
  const artist = input.artistName?.trim();
  const album = input.albumTitle?.trim();
  if (!artist || !album) {
    return [];
  }

  const params = new URLSearchParams({
    term: `${artist} ${album}`,
    country: ITUNES_COUNTRY,
    media: "music",
    entity: "album",
    attribute: "albumTerm",
    limit: "10"
  });
  const payload = await fetchJson<ItunesSearchResponse>(`https://itunes.apple.com/search?${params.toString()}`);
  const match = (payload?.results ?? []).find((result) => isStrictItunesMatch(result, input));
  const artworkUrl = match?.artworkUrl100 ? toHighResolutionItunesArtwork(match.artworkUrl100) : undefined;

  return isHttpUrl(artworkUrl)
    ? [{ coverType: "cover", remoteUrl: artworkUrl, source: "itunes" }]
    : [];
};

const cacheScope = (provider: CoverProvider, input: CoverFallbackInput): string => [
  provider,
  normalizeText(input.foreignAlbumId) ?? "no-id",
  normalizeText(input.artistName) ?? "no-artist",
  normalizeText(input.albumTitle) ?? "no-title",
  releaseYear(input.releaseDate)?.toString() ?? "no-year"
].join(":");

export const getCoverFallbackImages = async (
  input: CoverFallbackInput,
  fetchJson: FetchJson = defaultFetchJson
): Promise<LidarrImage[] | undefined> => {
  const coverArtArchiveCandidates = input.foreignAlbumId
    ? await fromJsonCache(
        COVER_CACHE_NAMESPACE,
        cacheScope("cover-art-archive", input),
        COVER_CACHE_TTL_MS,
        () => getCoverArtArchiveCandidates(input.foreignAlbumId as string, fetchJson)
      )
    : [];

  const candidates = coverArtArchiveCandidates.length > 0
    ? coverArtArchiveCandidates
    : await fromJsonCache(
        COVER_CACHE_NAMESPACE,
        cacheScope("itunes", input),
        COVER_CACHE_TTL_MS,
        () => getItunesCandidates(input, fetchJson)
      );

  const images = candidates.map(({ coverType, remoteUrl, url }) => ({ coverType, remoteUrl, url }));
  return images.length > 0 ? images : undefined;
};

export const __coverFallbackTestUtils = {
  getCoverArtArchiveCandidates,
  getItunesCandidates,
  isStrictItunesMatch,
  normalizeText,
  toHighResolutionItunesArtwork
};
