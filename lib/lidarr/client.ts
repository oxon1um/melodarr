import { clearJsonCache, fromJsonCache, invalidateJsonCacheNamespace } from "@/lib/cache/json-cache";

export type LidarrImage = {
  coverType?: string;
  remoteUrl?: string;
  url?: string;
};

type LidarrAlbumStatistics = {
  trackFileCount?: number;
  trackCount?: number;
  totalTrackCount?: number;
  percentOfTracks?: number;
};

export type LidarrArtistSearchResult = {
  artistName: string;
  foreignArtistId?: string;
  mbid?: string;
  overview?: string;
  status?: string;
  images?: LidarrImage[];
};

export type LidarrAlbumSearchResult = {
  title: string;
  artistName: string;
  foreignAlbumId?: string;
  foreignArtistId?: string;
  type?: string;
  releaseGroup?: "album" | "single";
  secondaryTypes?: string[];
  releaseStatuses?: string[];
  overview?: string;
  images?: LidarrImage[];
};

export type LidarrSongSearchResult = {
  title: string;
  artistName: string;
  albumTitle?: string;
  foreignAlbumId?: string;
  foreignSongId?: string;
  foreignArtistId?: string;
  duration?: number;
  trackNumber?: number;
  images?: LidarrImage[];
};

export type LidarrDiscoverSearchResult = {
  artists: LidarrArtistSearchResult[];
  albums: LidarrAlbumSearchResult[];
  singles: LidarrAlbumSearchResult[];
};

type LidarrArtist = {
  id: number;
  artistName: string;
  foreignArtistId?: string;
  metadataProfileId?: number;
  qualityProfileId?: number;
  rootFolderPath?: string;
  overview?: string;
  images?: LidarrImage[];
  albumCount?: number;
};

type LidarrArtistAlbum = {
  id: number;
  title: string;
  foreignAlbumId?: string;
  artistName?: string;
  foreignArtistId?: string;
  type?: string;
  releaseGroup?: "album" | "single";
  secondaryTypes?: string[];
  releaseStatuses?: string[];
  artistId?: number;
  monitored?: boolean;
  releaseDate?: string;
  images?: LidarrImage[];
  statistics?: LidarrAlbumStatistics;
  artist?: {
    artistName?: string;
    foreignArtistId?: string;
  };
};

type LidarrAlbum = {
  id: number;
  title: string;
  foreignAlbumId?: string;
  artistId?: number;
  monitored?: boolean;
  images?: LidarrImage[];
  statistics?: LidarrAlbumStatistics;
  artist?: {
    artistName?: string;
    foreignArtistId?: string;
  };
};

type LidarrArtistMatch = LidarrArtist & {
  source: "library" | "mbid" | "lookup";
};

type AddArtistInput = {
  artistName: string;
  foreignArtistId?: string;
  mbid?: string;
  qualityProfileId: number;
  metadataProfileId?: number;
  rootFolderPath: string;
  monitorMode: string;
  monitored?: boolean;
  searchForMissingAlbums?: boolean;
};

type AddAlbumInput = {
  albumTitle: string;
  artistName: string;
  foreignAlbumId?: string;
  foreignArtistId?: string;
  artistId?: number;
  qualityProfileId?: number;
  metadataProfileId?: number;
  rootFolderPath?: string;
};

type LidarrPublicArtistAlbum = {
  Id?: string;
  Title?: string;
  Type?: string;
  SecondaryTypes?: string[];
  ReleaseStatuses?: string[];
  ReleaseDate?: string | null;
};

type LidarrPublicArtistProfile = {
  id?: string;
  artistName?: string;
  overview?: string;
  images?: LidarrImage[];
  albums: LidarrPublicArtistAlbum[];
};

type LidarrPublicAlbumProfile = {
  id?: string;
  title?: string;
  artistName?: string;
  foreignArtistId?: string;
  type?: string;
  secondaryTypes?: string[];
  releaseStatuses?: string[];
  images?: LidarrImage[];
  tracks: LidarrSongSearchResult[];
};

type LidarrRootFolder = {
  id: number;
  path: string;
  accessible?: boolean;
  defaultMetadataProfileId?: number;
  defaultQualityProfileId?: number;
};

type LidarrQualityProfile = {
  id: number;
  name?: string;
};

type LidarrMetadataProfileOption = {
  allowed?: boolean;
  albumType?: {
    name?: string;
  };
  releaseStatus?: {
    name?: string;
  };
};

type LidarrMetadataProfile = {
  id: number;
  name?: string;
  primaryAlbumTypes?: LidarrMetadataProfileOption[];
  secondaryAlbumTypes?: LidarrMetadataProfileOption[];
  releaseStatuses?: LidarrMetadataProfileOption[];
};

type LidarrReleaseFilterRules = {
  allowedPrimaryTypes: Set<string>;
  allowedSecondaryTypes: Set<string>;
  allowedReleaseStatuses: Set<string>;
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
};

const pickString = (source: Record<string, unknown> | null, ...keys: string[]): string | undefined => {
  if (!source) return undefined;

  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return undefined;
};

const pickNumber = (source: Record<string, unknown> | null, ...keys: string[]): number | undefined => {
  if (!source) return undefined;

  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number") {
      return value;
    }
  }

  return undefined;
};

const pickStringArray = (source: Record<string, unknown> | null, ...keys: string[]): string[] | undefined => {
  if (!source) return undefined;

  for (const key of keys) {
    const value = source[key];
    if (!Array.isArray(value)) {
      continue;
    }

    const normalized = value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    if (normalized.length > 0) {
      return normalized;
    }
  }

  return undefined;
};

const normalizeImages = (value: unknown): LidarrImage[] | undefined => {
  if (!Array.isArray(value)) return undefined;

  const images = value
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => ({
      coverType: normalizeText(pickString(item, "coverType", "CoverType")),
      remoteUrl: pickString(item, "remoteUrl", "RemoteUrl"),
      url: pickString(item, "url", "Url")
    }));

  return images.length > 0 ? images : undefined;
};

const hasUsableImage = (image: LidarrImage | undefined): boolean =>
  Boolean(
    image
    && (
      (typeof image.remoteUrl === "string" && image.remoteUrl.trim().length > 0)
      || (typeof image.url === "string" && image.url.trim().length > 0)
    )
  );

const hasUsableImageSet = (images?: LidarrImage[]): boolean =>
  Array.isArray(images) && images.some((image) => hasUsableImage(image));

const normalizeStatistics = (value: unknown): LidarrAlbumStatistics | undefined => {
  const item = asRecord(value);
  if (!item) return undefined;

  const statistics: LidarrAlbumStatistics = {
    trackFileCount: pickNumber(item, "trackFileCount"),
    trackCount: pickNumber(item, "trackCount"),
    totalTrackCount: pickNumber(item, "totalTrackCount"),
    percentOfTracks: pickNumber(item, "percentOfTracks")
  };

  return Object.values(statistics).some((entry) => typeof entry === "number")
    ? statistics
    : undefined;
};

const normalizeAlbum = (raw: unknown): LidarrAlbumSearchResult | null => {
  const item = asRecord(raw);
  if (!item) return null;

  const artist = asRecord(item.artist);
  const title = pickString(item, "title", "albumTitle");
  const artistName = pickString(item, "artistName") ?? pickString(artist, "artistName", "name");

  if (!title || !artistName) return null;

  return {
    title,
    artistName,
    foreignAlbumId: pickString(item, "foreignAlbumId", "foreignReleaseId"),
    foreignArtistId: pickString(item, "foreignArtistId") ?? pickString(artist, "foreignArtistId"),
    type: pickString(item, "type", "albumType", "Type"),
    releaseGroup: normalizeReleaseGroup(pickString(item, "type", "albumType", "Type")),
    secondaryTypes: pickStringArray(item, "secondaryTypes", "SecondaryTypes"),
    releaseStatuses: pickStringArray(item, "releaseStatuses", "ReleaseStatuses"),
    overview: pickString(item, "overview"),
    images: normalizeImages(item.images ?? item.Images ?? artist?.images ?? artist?.Images)
  };
};

const normalizeArtistAlbum = (raw: unknown): LidarrArtistAlbum | null => {
  const item = asRecord(raw);
  if (!item) return null;

  const artist = asRecord(item.artist);
  const title = pickString(item, "title", "albumTitle");
  const artistName = pickString(item, "artistName") ?? pickString(artist, "artistName", "name");

  if (!title || !artistName) return null;

  return {
    id: pickNumber(item, "id") ?? 0,
    title,
    foreignAlbumId: pickString(item, "foreignAlbumId", "foreignReleaseId"),
    artistName,
    foreignArtistId: pickString(item, "foreignArtistId") ?? pickString(artist, "foreignArtistId"),
    type: pickString(item, "type", "albumType", "Type"),
    releaseGroup: normalizeReleaseGroup(pickString(item, "type", "albumType", "Type")),
    secondaryTypes: pickStringArray(item, "secondaryTypes", "SecondaryTypes"),
    releaseStatuses: pickStringArray(item, "releaseStatuses", "ReleaseStatuses"),
    artistId: pickNumber(item, "artistId"),
    monitored: typeof item.monitored === "boolean" ? item.monitored : undefined,
    releaseDate: pickString(item, "releaseDate", "ReleaseDate"),
    images: normalizeImages(item.images ?? item.Images ?? artist?.images ?? artist?.Images),
    statistics: normalizeStatistics(item.statistics),
    artist: artist
      ? {
          artistName: pickString(artist, "artistName", "name"),
          foreignArtistId: pickString(artist, "foreignArtistId")
        }
      : undefined
  };
};

const normalizeSong = (raw: unknown): LidarrSongSearchResult | null => {
  const item = asRecord(raw);
  if (!item) return null;

  const artist = asRecord(item.artist);
  const album = asRecord(item.album);
  const title = pickString(item, "title", "trackTitle", "songTitle");
  const artistName = pickString(item, "artistName") ?? pickString(artist, "artistName", "name");

  if (!title || !artistName) return null;

  return {
    title: pickString(item, "title", "Title", "trackTitle", "songTitle", "TrackName") ?? title,
    artistName,
    albumTitle: pickString(item, "albumTitle") ?? pickString(album, "title", "albumTitle"),
    foreignAlbumId: pickString(item, "foreignAlbumId", "ForeignAlbumId") ?? pickString(album, "foreignAlbumId"),
    foreignSongId: pickString(item, "foreignSongId", "foreignTrackId", "foreignRecordingId", "ForeignTrackId", "RecordingId", "Id"),
    foreignArtistId: pickString(item, "foreignArtistId") ?? pickString(artist, "foreignArtistId"),
    duration: pickNumber(item, "duration", "durationMs"),
    trackNumber: pickNumber(item, "trackNumber", "TrackNumber", "TrackPosition"),
    images: normalizeImages(item.images ?? item.Images ?? album?.images ?? album?.Images ?? artist?.images ?? artist?.Images)
  };
};

const normalizeText = (value: string | undefined): string | undefined => {
  if (!value) return undefined;

  const normalized = value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();

  return normalized.length > 0 ? normalized : undefined;
};

const matchesSearchText = (value: string | undefined, term: string): boolean => {
  const normalizedValue = normalizeText(value);
  const normalizedTerm = normalizeText(term);

  return Boolean(normalizedValue && normalizedTerm && normalizedValue.includes(normalizedTerm));
};

const albumSearchKey = (album: Pick<LidarrAlbumSearchResult, "title" | "artistName" | "foreignAlbumId">): string =>
  album.foreignAlbumId ?? `${normalizeText(album.artistName) ?? album.artistName}:${normalizeText(album.title) ?? album.title}`;

const matchesAlbumSearchTerm = (album: Pick<LidarrAlbumSearchResult, "title" | "artistName">, term: string): boolean =>
  matchesSearchText(album.title, term) || matchesSearchText(album.artistName, term);

const matchesArtistIdentity = (
  album: Pick<LidarrArtistAlbum, "artistName" | "foreignArtistId"> & { artist?: { artistName?: string; foreignArtistId?: string } },
  foreignArtistId: string,
  artistName?: string
): boolean => {
  const albumForeignArtistId = album.foreignArtistId ?? album.artist?.foreignArtistId;
  if (albumForeignArtistId) {
    return albumForeignArtistId === foreignArtistId;
  }

  const normalizedArtistName = normalizeText(artistName);
  if (!normalizedArtistName) return false;

  return normalizeText(album.artistName ?? album.artist?.artistName) === normalizedArtistName;
};

const matchesAlbumIdentity = (
  album: Pick<LidarrArtistAlbum, "title" | "foreignAlbumId" | "artistName" | "foreignArtistId"> & {
    artist?: { artistName?: string; foreignArtistId?: string };
  },
  foreignAlbumId: string,
  albumTitle?: string,
  artistName?: string,
  foreignArtistId?: string
): boolean => {
  if (album.foreignAlbumId && album.foreignAlbumId === foreignAlbumId) {
    return true;
  }

  const normalizedAlbumTitle = normalizeText(albumTitle);
  if (!normalizedAlbumTitle || normalizeText(album.title) !== normalizedAlbumTitle) {
    return false;
  }

  if (foreignArtistId) {
    const albumForeignArtistId = album.foreignArtistId ?? album.artist?.foreignArtistId;
    if (albumForeignArtistId) {
      return albumForeignArtistId === foreignArtistId;
    }
  }

  const normalizedArtistName = normalizeText(artistName);
  if (!normalizedArtistName) {
    return true;
  }

  return normalizeText(album.artistName ?? album.artist?.artistName) === normalizedArtistName;
};

const matchesSongToAlbum = (
  song: Pick<LidarrSongSearchResult, "albumTitle" | "artistName" | "foreignAlbumId">,
  foreignAlbumId: string,
  albumTitle?: string,
  artistName?: string
): boolean => {
  if (song.foreignAlbumId && song.foreignAlbumId === foreignAlbumId) {
    return true;
  }

  const normalizedAlbumTitle = normalizeText(albumTitle);
  if (!normalizedAlbumTitle || normalizeText(song.albumTitle) !== normalizedAlbumTitle) {
    return false;
  }

  const normalizedArtistName = normalizeText(artistName);
  if (!normalizedArtistName) {
    return true;
  }

  return normalizeText(song.artistName) === normalizedArtistName;
};

const firstNonEmptyText = (...values: Array<string | undefined>): string | undefined =>
  values.find((value) => typeof value === "string" && value.trim().length > 0);

const firstImageSet = (...values: Array<LidarrImage[] | undefined>): LidarrImage[] | undefined =>
  values.find((images) => hasUsableImageSet(images));

const firstNonEmptyArray = (...values: Array<string[] | undefined>): string[] | undefined =>
  values.find((items) => Array.isArray(items) && items.length > 0);

const firstPositiveNumber = (...values: Array<number | undefined>): number | undefined =>
  values.find((value) => typeof value === "number" && value > 0);

const compactRecord = <T extends Record<string, unknown>>(value: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null)
  ) as Partial<T>;

const normalizeReleaseGroup = (type?: string): "album" | "single" => {
  const normalizedType = normalizeText(type);
  return normalizedType === "single" ? "single" : "album";
};

const artistSearchMatches = (
  artist: Pick<LidarrArtist, "artistName" | "foreignArtistId">,
  foreignArtistId: string,
  artistName?: string
): boolean => {
  if (artist.foreignArtistId && artist.foreignArtistId === foreignArtistId) {
    return true;
  }

  const normalizedArtistName = normalizeText(artistName);
  if (!normalizedArtistName) return false;

  return normalizeText(artist.artistName) === normalizedArtistName;
};

const filterArtistSearchResults = (
  artists: LidarrArtistSearchResult[],
  term: string
): LidarrArtistSearchResult[] => {
  const normalizedTerm = normalizeText(term);
  if (!normalizedTerm) {
    return artists;
  }

  const exactOrPrefixMatches = artists.filter((artist) => {
    const normalizedName = normalizeText(artist.artistName);
    if (!normalizedName) {
      return false;
    }

    return normalizedName === normalizedTerm || normalizedName.startsWith(normalizedTerm);
  });

  const exactMatches = exactOrPrefixMatches.filter((artist) =>
    normalizeText(artist.artistName) === normalizedTerm
  );
  if (exactMatches.length > 0) {
    return exactMatches;
  }

  if (normalizedTerm.length >= 4 && exactOrPrefixMatches.length > 0) {
    return exactOrPrefixMatches;
  }

  return artists;
};

const artistAlbumKey = (
  album: Pick<LidarrArtistAlbum, "title" | "artistName" | "foreignAlbumId"> & {
    artist?: { artistName?: string };
  }
): string =>
  album.foreignAlbumId ??
  `${normalizeText(album.artistName ?? album.artist?.artistName) ?? album.artistName ?? album.artist?.artistName}:${normalizeText(album.title) ?? album.title}`;

const mergeAlbumSearchResults = (
  primary: LidarrAlbumSearchResult,
  secondary: LidarrAlbumSearchResult
): LidarrAlbumSearchResult => ({
  ...secondary,
  ...primary,
  title: firstNonEmptyText(primary.title, secondary.title) ?? primary.title,
  artistName: firstNonEmptyText(primary.artistName, secondary.artistName) ?? primary.artistName,
  foreignAlbumId: firstNonEmptyText(primary.foreignAlbumId, secondary.foreignAlbumId),
  foreignArtistId: firstNonEmptyText(primary.foreignArtistId, secondary.foreignArtistId),
  type: firstNonEmptyText(primary.type, secondary.type),
  releaseGroup: primary.releaseGroup ?? secondary.releaseGroup,
  secondaryTypes: firstNonEmptyArray(primary.secondaryTypes, secondary.secondaryTypes),
  releaseStatuses: firstNonEmptyArray(primary.releaseStatuses, secondary.releaseStatuses),
  overview: firstNonEmptyText(primary.overview, secondary.overview),
  images: firstImageSet(primary.images, secondary.images)
});

const mergeArtistAlbums = (
  primary: LidarrArtistAlbum,
  secondary: LidarrArtistAlbum
): LidarrArtistAlbum => ({
  ...secondary,
  ...primary,
  title: firstNonEmptyText(primary.title, secondary.title) ?? primary.title,
  foreignAlbumId: firstNonEmptyText(primary.foreignAlbumId, secondary.foreignAlbumId),
  artistName: firstNonEmptyText(primary.artistName, secondary.artistName, primary.artist?.artistName, secondary.artist?.artistName),
  foreignArtistId: firstNonEmptyText(primary.foreignArtistId, secondary.foreignArtistId, primary.artist?.foreignArtistId, secondary.artist?.foreignArtistId),
  type: firstNonEmptyText(primary.type, secondary.type),
  releaseGroup: primary.releaseGroup ?? secondary.releaseGroup,
  secondaryTypes: firstNonEmptyArray(primary.secondaryTypes, secondary.secondaryTypes),
  releaseStatuses: firstNonEmptyArray(primary.releaseStatuses, secondary.releaseStatuses),
  releaseDate: firstNonEmptyText(primary.releaseDate, secondary.releaseDate),
  images: firstImageSet(primary.images, secondary.images),
  statistics: primary.statistics ?? secondary.statistics,
  artist: primary.artist ?? secondary.artist,
  artistId: primary.artistId ?? secondary.artistId
});

const artistAlbumToSearchResult = (album: LidarrArtistAlbum): LidarrAlbumSearchResult => ({
  title: album.title,
  artistName: album.artistName ?? album.artist?.artistName ?? "Unknown artist",
  foreignAlbumId: album.foreignAlbumId,
  foreignArtistId: album.foreignArtistId ?? album.artist?.foreignArtistId,
  type: album.type,
  releaseGroup: album.releaseGroup,
  secondaryTypes: album.secondaryTypes,
  releaseStatuses: album.releaseStatuses,
  overview: undefined,
  images: album.images
});

const trackIdentityKey = (track: LidarrSongSearchResult): string =>
  track.foreignSongId
  ?? `${normalizeText(track.title) ?? track.title}:${track.trackNumber ?? 0}:${normalizeText(track.artistName) ?? track.artistName}`;

const DEFAULT_RELEASE_FILTER_RULES = (): LidarrReleaseFilterRules => ({
  allowedPrimaryTypes: new Set(["album"]),
  allowedSecondaryTypes: new Set(["studio"]),
  allowedReleaseStatuses: new Set(["official"])
});

const normalizedSecondaryTypes = (secondaryTypes?: string[]): string[] => {
  const normalized = (secondaryTypes ?? [])
    .map((item) => normalizeText(item))
    .filter((item): item is string => Boolean(item));

  return normalized.length > 0 ? normalized : ["studio"];
};

const normalizedReleaseStatuses = (releaseStatuses?: string[]): string[] => {
  const normalized = (releaseStatuses ?? [])
    .map((item) => normalizeText(item))
    .filter((item): item is string => Boolean(item));

  return normalized.length > 0 ? normalized : ["official"];
};

const isReleaseAllowedByRules = (
  album: {
    type?: string;
    secondaryTypes?: string[];
    releaseStatuses?: string[];
  },
  rules: LidarrReleaseFilterRules
): boolean => {
  const normalizedPrimaryType = normalizeText(album.type) ?? "album";
  if (!rules.allowedPrimaryTypes.has(normalizedPrimaryType)) {
    return false;
  }

  const secondaryTypes = normalizedSecondaryTypes(album.secondaryTypes);
  if (secondaryTypes.some((secondaryType) => !rules.allowedSecondaryTypes.has(secondaryType))) {
    return false;
  }

  const releaseStatuses = normalizedReleaseStatuses(album.releaseStatuses);
  return releaseStatuses.some((releaseStatus) => rules.allowedReleaseStatuses.has(releaseStatus));
};

export class LidarrClient {
  private static readonly libraryCacheTtlMs = 30_000;

  private static readonly searchCacheTtlMs = 20_000;

  private static readonly publicCacheTtlMs = 10 * 60_000;

  private static readonly exactLookupCacheTtlMs = 5 * 60_000;

  private static readonly profileCacheTtlMs = 10 * 60_000;

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly debug: boolean = false
  ) {}

  static clearCache(): void {
    clearJsonCache();
  }

  private static async fromCache<T>(
    namespace: string,
    scope: string,
    ttlMs: number,
    loader: () => Promise<T>
  ): Promise<T> {
    return fromJsonCache(namespace, scope, ttlMs, loader);
  }

  private getCacheNamespace(): string {
    return `lidarr:${this.baseUrl.replace(/\/$/, "")}`;
  }

  private async fromCache<T>(scope: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    return LidarrClient.fromCache(this.getCacheNamespace(), scope, ttlMs, loader);
  }

  private async invalidateCaches(): Promise<void> {
    await invalidateJsonCacheNamespace(this.getCacheNamespace());
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl.replace(/\/$/, "")}${path}`;

    const response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": this.apiKey,
        ...(init?.headers ?? {})
      }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Lidarr API error (${response.status}): ${text}`);
    }

    return (await response.json()) as T;
  }

  private async tryRequest<T>(path: string, init?: RequestInit): Promise<T | null> {
    try {
      return await this.request<T>(path, init);
    } catch {
      return null;
    }
  }

  private getTimeoutInit(timeoutMs = 2_500): RequestInit | undefined {
    if (typeof AbortSignal === "undefined" || !("timeout" in AbortSignal)) {
      return undefined;
    }

    return { signal: AbortSignal.timeout(timeoutMs) };
  }

  private async requestJson<T>(url: string): Promise<T> {
    const response = await fetch(url, this.getTimeoutInit());

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Remote API error (${response.status}): ${text}`);
    }

    return (await response.json()) as T;
  }

  private async tryRequestJson<T>(url: string): Promise<T | null> {
    try {
      return await this.requestJson<T>(url);
    } catch {
      return null;
    }
  }

  private withTransformedImages<T extends { images?: LidarrImage[] }>(value: T): T {
    return {
      ...value,
      images: this.transformImages(value.images)
    };
  }

  private mergeAlbumCollections(...collections: LidarrAlbumSearchResult[][]): LidarrAlbumSearchResult[] {
    return collections.reduce<LidarrAlbumSearchResult[]>((results, collection) => {
      for (const album of collection) {
        const key = albumSearchKey(album);
        const existingIndex = results.findIndex((item) => albumSearchKey(item) === key);
        if (existingIndex === -1) {
          results.push(this.withTransformedImages(album));
        } else {
          results[existingIndex] = this.withTransformedImages(
            mergeAlbumSearchResults(results[existingIndex], album)
          );
        }
      }

      return results;
    }, []);
  }

  private mergeArtistAlbumCollections(...collections: LidarrArtistAlbum[][]): LidarrArtistAlbum[] {
    return collections.reduce<LidarrArtistAlbum[]>((results, collection) => {
      for (const album of collection) {
        const key = artistAlbumKey(album);
        const existingIndex = results.findIndex((item) => artistAlbumKey(item) === key);
        if (existingIndex === -1) {
          results.push(this.withTransformedImages(album));
        } else {
          results[existingIndex] = this.withTransformedImages(
            mergeArtistAlbums(results[existingIndex], album)
          );
        }
      }

      return results;
    }, []);
  }

  private async getPublicArtistProfile(foreignArtistId: string): Promise<LidarrPublicArtistProfile | null> {
    const payload = await this.fromCache(
      `public-artist:${foreignArtistId}`,
      LidarrClient.publicCacheTtlMs,
      async () =>
        this.tryRequestJson<unknown>(
          `https://api.lidarr.audio/api/v0.4/artist/${encodeURIComponent(foreignArtistId)}`
        )
    );
    const item = asRecord(payload);
    if (!item) {
      return null;
    }

    const albums = Array.isArray(item.Albums)
      ? item.Albums
          .map((album) => asRecord(album))
          .filter((album): album is Record<string, unknown> => Boolean(album))
          .map((album) => ({
            Id: pickString(album, "Id", "id"),
            Title: pickString(album, "Title", "title"),
            Type: pickString(album, "Type", "type"),
            SecondaryTypes: pickStringArray(album, "SecondaryTypes", "secondaryTypes"),
            ReleaseStatuses: pickStringArray(album, "ReleaseStatuses", "releaseStatuses"),
            ReleaseDate: pickString(album, "ReleaseDate", "releaseDate")
          }))
      : [];

    return {
      id: pickString(item, "id", "Id"),
      artistName: pickString(item, "artistName", "artistname", "ArtistName"),
      overview: pickString(item, "overview", "Overview"),
      images: normalizeImages(item.images ?? item.Images),
      albums
    };
  }

  private normalizeMetadataProfile(raw: unknown): LidarrMetadataProfile | null {
    const item = asRecord(raw);
    const id = pickNumber(item, "id");
    if (!item || typeof id !== "number") {
      return null;
    }

    const normalizeOptions = (value: unknown, kind: "albumType" | "releaseStatus"): LidarrMetadataProfileOption[] | undefined => {
      if (!Array.isArray(value)) {
        return undefined;
      }

      const options = value
        .map((entry) => asRecord(entry))
        .filter((entry): entry is Record<string, unknown> => Boolean(entry))
        .map((entry) => ({
          allowed: typeof entry.allowed === "boolean" ? entry.allowed : undefined,
          albumType: kind === "albumType" ? { name: pickString(asRecord(entry.albumType), "name") } : undefined,
          releaseStatus: kind === "releaseStatus" ? { name: pickString(asRecord(entry.releaseStatus), "name") } : undefined
        }));

      return options.length > 0 ? options : undefined;
    };

    return {
      id,
      name: pickString(item, "name"),
      primaryAlbumTypes: normalizeOptions(item.primaryAlbumTypes, "albumType"),
      secondaryAlbumTypes: normalizeOptions(item.secondaryAlbumTypes, "albumType"),
      releaseStatuses: normalizeOptions(item.releaseStatuses, "releaseStatus")
    };
  }

  async getMetadataProfile(profileId?: number | null): Promise<LidarrMetadataProfile | null> {
    if (!profileId || profileId <= 0) {
      return null;
    }

    const payload = await this.fromCache(
      `metadata-profile:${profileId}`,
      LidarrClient.profileCacheTtlMs,
      async () => this.tryRequest<unknown[]>("/api/v1/metadataprofile")
    );
    const profiles = (payload ?? [])
      .map((entry) => this.normalizeMetadataProfile(entry))
      .filter((entry): entry is LidarrMetadataProfile => Boolean(entry));

    return profiles.find((profile) => profile.id === profileId) ?? null;
  }

  async getRootFolders(): Promise<LidarrRootFolder[]> {
    const payload = await this.fromCache(
      "root-folders",
      LidarrClient.profileCacheTtlMs,
      async () => this.tryRequest<unknown[]>("/api/v1/rootfolder")
    );

    return (payload ?? [])
      .map((entry) => asRecord(entry))
      .filter((entry): entry is Record<string, unknown> => Boolean(entry))
      .map((entry) => ({
        id: pickNumber(entry, "id") ?? 0,
        path: pickString(entry, "path") ?? "",
        accessible: typeof entry.accessible === "boolean" ? entry.accessible : undefined,
        defaultMetadataProfileId: pickNumber(entry, "defaultMetadataProfileId"),
        defaultQualityProfileId: pickNumber(entry, "defaultQualityProfileId")
      }))
      .filter((entry) => entry.id > 0 && entry.path.length > 0);
  }

  async getQualityProfiles(): Promise<LidarrQualityProfile[]> {
    const payload = await this.fromCache(
      "quality-profiles",
      LidarrClient.profileCacheTtlMs,
      async () => this.tryRequest<unknown[]>("/api/v1/qualityprofile")
    );

    return (payload ?? [])
      .map((entry) => asRecord(entry))
      .filter((entry): entry is Record<string, unknown> => Boolean(entry))
      .map((entry) => ({
        id: pickNumber(entry, "id") ?? 0,
        name: pickString(entry, "name")
      }))
      .filter((entry) => entry.id > 0);
  }

  async getEffectiveAddDefaults(input?: {
    rootFolderPath?: string | null;
    qualityProfileId?: number | null;
    metadataProfileId?: number | null;
  }): Promise<{
    rootFolderPath?: string;
    qualityProfileId?: number;
    metadataProfileId?: number;
  }> {
    const [rootFolders, qualityProfiles] = await Promise.all([
      this.getRootFolders(),
      this.getQualityProfiles()
    ]);

    const accessibleRootFolders = rootFolders.filter((folder) => folder.accessible !== false);
    const matchingRootFolder = input?.rootFolderPath
      ? accessibleRootFolders.find((folder) => folder.path === input.rootFolderPath)
      : undefined;
    const defaultRootFolder = accessibleRootFolders.find((folder) =>
      firstPositiveNumber(folder.defaultQualityProfileId, folder.defaultMetadataProfileId)
    ) ?? accessibleRootFolders[0];

    const rootFolder = matchingRootFolder ?? defaultRootFolder;
    const qualityProfileId = firstPositiveNumber(
      input?.qualityProfileId ?? undefined,
      rootFolder?.defaultQualityProfileId,
      qualityProfiles[0]?.id
    );
    const metadataProfileId = firstPositiveNumber(
      input?.metadataProfileId ?? undefined,
      rootFolder?.defaultMetadataProfileId
    );

    return {
      rootFolderPath: firstNonEmptyText(input?.rootFolderPath ?? undefined, rootFolder?.path),
      qualityProfileId,
      metadataProfileId
    };
  }

  async getReleaseFilterRules(profileId?: number | null): Promise<LidarrReleaseFilterRules> {
    const effectiveProfileId = profileId && profileId > 0
      ? profileId
      : (await this.getEffectiveAddDefaults()).metadataProfileId;
    const profile = await this.getMetadataProfile(effectiveProfileId);
    if (!profile) {
      return DEFAULT_RELEASE_FILTER_RULES();
    }

    const allowedPrimaryTypes = new Set(
      (profile.primaryAlbumTypes ?? [])
        .filter((entry) => entry.allowed)
        .map((entry) => normalizeText(entry.albumType?.name))
        .filter((entry): entry is string => Boolean(entry))
    );
    const allowedSecondaryTypes = new Set(
      (profile.secondaryAlbumTypes ?? [])
        .filter((entry) => entry.allowed)
        .map((entry) => normalizeText(entry.albumType?.name))
        .filter((entry): entry is string => Boolean(entry))
    );
    const allowedReleaseStatuses = new Set(
      (profile.releaseStatuses ?? [])
        .filter((entry) => entry.allowed)
        .map((entry) => normalizeText(entry.releaseStatus?.name))
        .filter((entry): entry is string => Boolean(entry))
    );

    return {
      allowedPrimaryTypes: allowedPrimaryTypes.size > 0 ? allowedPrimaryTypes : DEFAULT_RELEASE_FILTER_RULES().allowedPrimaryTypes,
      allowedSecondaryTypes: allowedSecondaryTypes.size > 0 ? allowedSecondaryTypes : DEFAULT_RELEASE_FILTER_RULES().allowedSecondaryTypes,
      allowedReleaseStatuses: allowedReleaseStatuses.size > 0 ? allowedReleaseStatuses : DEFAULT_RELEASE_FILTER_RULES().allowedReleaseStatuses
    };
  }

  private async getExactArtistLookupMatch(foreignArtistId: string): Promise<LidarrArtistMatch | null> {
    const encoded = encodeURIComponent(`lidarr:${foreignArtistId}`);
    const searchResults = await this.fromCache(
      `artist-exact:${foreignArtistId}`,
      LidarrClient.exactLookupCacheTtlMs,
      async () => this.tryRequest<LidarrArtist[]>(`/api/v1/artist/lookup?term=${encoded}`)
    );
    if (!searchResults || searchResults.length === 0) {
      return null;
    }

    const match = searchResults.find((artist) => artist.foreignArtistId === foreignArtistId) ?? searchResults[0];
    return match
      ? {
          ...match,
          source: "lookup"
        }
      : null;
  }

  private async getExactAlbumLookup(foreignAlbumId: string): Promise<LidarrArtistAlbum | null> {
    const payload = await this.getExactAlbumLookupPayload(foreignAlbumId);
    if (!payload) {
      return null;
    }

    const artist = asRecord(payload.artist);
    const title = pickString(payload, "title", "albumTitle");
    const artistName = pickString(payload, "artistName") ?? pickString(artist, "artistName", "name");

    if (!title || !artistName) {
      return null;
    }

    let exactLookup: LidarrArtistAlbum = this.withTransformedImages({
      id: pickNumber(payload, "id") ?? 0,
      title,
      foreignAlbumId: pickString(payload, "foreignAlbumId", "foreignReleaseId") ?? foreignAlbumId,
      artistName,
      foreignArtistId: pickString(payload, "foreignArtistId") ?? pickString(artist, "foreignArtistId"),
      type: pickString(payload, "type", "albumType", "Type"),
      releaseGroup: normalizeReleaseGroup(pickString(payload, "type", "albumType", "Type")),
      secondaryTypes: pickStringArray(payload, "secondaryTypes", "SecondaryTypes"),
      releaseStatuses: pickStringArray(payload, "releaseStatuses", "ReleaseStatuses"),
      artistId: pickNumber(payload, "artistId"),
      releaseDate: pickString(payload, "releaseDate", "ReleaseDate"),
      images: normalizeImages(payload.images ?? payload.Images ?? artist?.images ?? artist?.Images),
      statistics: normalizeStatistics(payload.statistics),
      artist: artist
        ? {
            artistName: pickString(artist, "artistName", "name"),
            foreignArtistId: pickString(artist, "foreignArtistId")
          }
        : undefined
    });

    if (!hasUsableImageSet(exactLookup.images)) {
      const publicAlbum = await this.getPublicAlbumProfile(foreignAlbumId);
      if (publicAlbum) {
        exactLookup = mergeArtistAlbums(
          {
            ...exactLookup,
            title: firstNonEmptyText(exactLookup.title, publicAlbum.title) ?? exactLookup.title,
            artistName: firstNonEmptyText(exactLookup.artistName, publicAlbum.artistName) ?? exactLookup.artistName,
            foreignArtistId: firstNonEmptyText(exactLookup.foreignArtistId, publicAlbum.foreignArtistId),
            type: firstNonEmptyText(exactLookup.type, publicAlbum.type),
            secondaryTypes: firstNonEmptyArray(exactLookup.secondaryTypes, publicAlbum.secondaryTypes),
            releaseStatuses: firstNonEmptyArray(exactLookup.releaseStatuses, publicAlbum.releaseStatuses),
            images: firstImageSet(exactLookup.images, publicAlbum.images)
          },
          exactLookup
        );
      }
    }

    return exactLookup;
  }

  private async getExactAlbumLookupPayload(foreignAlbumId: string): Promise<Record<string, unknown> | null> {
    const encoded = encodeURIComponent(`lidarr:${foreignAlbumId}`);
    const payload = await this.fromCache(
      `album-exact-payload:${foreignAlbumId}`,
      LidarrClient.exactLookupCacheTtlMs,
      async () => this.tryRequest<unknown>(`/api/v1/album/lookup?term=${encoded}`)
    );

    if (Array.isArray(payload)) {
      const matchingEntry = payload
        .map((item) => asRecord(item))
        .find((item) => pickString(item, "foreignAlbumId", "foreignReleaseId") === foreignAlbumId);
      return matchingEntry ?? null;
    }

    return asRecord(payload);
  }

  private async getPublicArtistAlbums(
    foreignArtistId: string,
    artistName?: string,
    rules: LidarrReleaseFilterRules = DEFAULT_RELEASE_FILTER_RULES(),
    hydrateAlbums: boolean = false,
    hydrateLimit: number = 0
  ): Promise<LidarrArtistAlbum[]> {
    const profile = await this.getPublicArtistProfile(foreignArtistId);
    if (!profile || profile.albums.length === 0) {
      return [];
    }

    const publicAlbums = profile.albums
      .filter((album) =>
        isReleaseAllowedByRules({
          type: album.Type,
          secondaryTypes: album.SecondaryTypes,
          releaseStatuses: album.ReleaseStatuses
        }, rules)
      )
      .map<LidarrArtistAlbum>((album) => ({
        id: 0,
        title: album.Title ?? "Unknown album",
        foreignAlbumId: album.Id,
        artistName: artistName ?? profile.artistName,
        foreignArtistId,
        type: album.Type,
        releaseGroup: normalizeReleaseGroup(album.Type),
        secondaryTypes: album.SecondaryTypes,
        releaseStatuses: album.ReleaseStatuses,
        releaseDate: album.ReleaseDate ?? undefined
      }));

    if (!hydrateAlbums || hydrateLimit === 0) {
      return publicAlbums;
    }

    const hydratedAlbumIds = new Set(publicAlbums.slice(0, hydrateLimit).map((album) => album.foreignAlbumId));
    const hydratedAlbums = await Promise.all(
      publicAlbums.map(async (album) => {
        if (!album.foreignAlbumId || !hydratedAlbumIds.has(album.foreignAlbumId)) {
          return this.withTransformedImages(album);
        }

        return this.hydrateArtistAlbumMetadata(album);
      })
    );

    return hydratedAlbums;
  }

  private async hydrateArtistAlbumMetadata(album: LidarrArtistAlbum): Promise<LidarrArtistAlbum> {
    if (!album.foreignAlbumId) {
      return this.withTransformedImages(album);
    }

    let hydratedAlbum = album;
    const exactLookup = await this.getExactAlbumLookup(album.foreignAlbumId);
    if (exactLookup) {
      hydratedAlbum = mergeArtistAlbums(exactLookup, hydratedAlbum);
    }

    if (!hasUsableImageSet(hydratedAlbum.images)) {
      const publicAlbum = await this.getPublicAlbumProfile(album.foreignAlbumId);
      if (publicAlbum) {
        hydratedAlbum = mergeArtistAlbums(
          {
            ...hydratedAlbum,
            title: firstNonEmptyText(hydratedAlbum.title, publicAlbum.title) ?? hydratedAlbum.title,
            artistName: firstNonEmptyText(hydratedAlbum.artistName, publicAlbum.artistName) ?? hydratedAlbum.artistName,
            foreignArtistId: firstNonEmptyText(hydratedAlbum.foreignArtistId, publicAlbum.foreignArtistId),
            type: firstNonEmptyText(hydratedAlbum.type, publicAlbum.type),
            secondaryTypes: firstNonEmptyArray(hydratedAlbum.secondaryTypes, publicAlbum.secondaryTypes),
            releaseStatuses: firstNonEmptyArray(hydratedAlbum.releaseStatuses, publicAlbum.releaseStatuses),
            images: firstImageSet(hydratedAlbum.images, publicAlbum.images)
          },
          hydratedAlbum
        );
      }
    }

    if (!hasUsableImageSet(hydratedAlbum.images)) {
      const detailedAlbum = await this.getAlbumByForeignId(album.foreignAlbumId, album.artistName);
      if (detailedAlbum) {
        hydratedAlbum = mergeArtistAlbums(detailedAlbum, hydratedAlbum);
      }
    }

    return this.withTransformedImages(hydratedAlbum);
  }

  private async hydrateArtistAlbumCollectionImages(
    albums: LidarrArtistAlbum[],
    limit: number = 24
  ): Promise<LidarrArtistAlbum[]> {
    return Promise.all(
      albums.map(async (album, index) => {
        if (index >= limit || firstImageSet(album.images)) {
          return this.withTransformedImages(album);
        }

        return this.hydrateArtistAlbumMetadata(album);
      })
    );
  }

  private async hydrateDiscoverAlbumResults(
    albums: LidarrAlbumSearchResult[],
    limit: number = 24
  ): Promise<LidarrAlbumSearchResult[]> {
    return Promise.all(
      albums.map(async (album, index) => {
        if (index >= limit || firstImageSet(album.images) || !album.foreignAlbumId) {
          return this.withTransformedImages(album);
        }

        let hydratedAlbum = album;
        const publicAlbum = await this.getPublicAlbumProfile(album.foreignAlbumId);
        if (publicAlbum) {
          hydratedAlbum = mergeAlbumSearchResults(
            {
              ...hydratedAlbum,
              title: firstNonEmptyText(hydratedAlbum.title, publicAlbum.title) ?? hydratedAlbum.title,
              artistName: firstNonEmptyText(hydratedAlbum.artistName, publicAlbum.artistName) ?? hydratedAlbum.artistName,
              foreignArtistId: firstNonEmptyText(hydratedAlbum.foreignArtistId, publicAlbum.foreignArtistId),
              type: firstNonEmptyText(hydratedAlbum.type, publicAlbum.type),
              secondaryTypes: firstNonEmptyArray(hydratedAlbum.secondaryTypes, publicAlbum.secondaryTypes),
              releaseStatuses: firstNonEmptyArray(hydratedAlbum.releaseStatuses, publicAlbum.releaseStatuses),
              images: firstImageSet(hydratedAlbum.images, publicAlbum.images)
            },
            hydratedAlbum
          );
        }

        const detailedAlbum = await this.getAlbumByForeignId(album.foreignAlbumId, album.artistName);
        if (detailedAlbum) {
          hydratedAlbum = mergeAlbumSearchResults(
            {
              title: detailedAlbum.title,
              artistName: detailedAlbum.artistName ?? album.artistName,
              foreignAlbumId: detailedAlbum.foreignAlbumId,
              foreignArtistId: detailedAlbum.foreignArtistId,
              type: detailedAlbum.type,
              releaseGroup: detailedAlbum.releaseGroup,
              secondaryTypes: detailedAlbum.secondaryTypes,
              releaseStatuses: detailedAlbum.releaseStatuses,
              images: detailedAlbum.images
            },
            hydratedAlbum
          );
        }

        return this.withTransformedImages(hydratedAlbum);
      })
    );
  }

  private async getPublicAlbumProfile(foreignAlbumId: string): Promise<LidarrPublicAlbumProfile | null> {
    const payload = await this.fromCache(
      `public-album:${foreignAlbumId}`,
      LidarrClient.publicCacheTtlMs,
      async () =>
        this.tryRequestJson<unknown>(
          `https://api.lidarr.audio/api/v0.4/album/${encodeURIComponent(foreignAlbumId)}`
        )
    );
    const item = asRecord(payload);
    if (!item) {
      return null;
    }

    const artist = asRecord(item.Artist ?? item.artist);
    const artistList = Array.isArray(item.Artists)
      ? item.Artists
      : Array.isArray(item.artists)
        ? item.artists
        : [];
    const firstArtist = asRecord(artistList[0]);
    const artistName = firstNonEmptyText(
      pickString(item, "ArtistName", "artistName"),
      pickString(artist, "ArtistName", "artistName", "name"),
      pickString(firstArtist, "ArtistName", "artistName", "artistname", "name")
    );
    const resolvedForeignArtistId = firstNonEmptyText(
      pickString(item, "ForeignArtistId", "foreignArtistId"),
      pickString(artist, "ForeignArtistId", "foreignArtistId"),
      pickString(firstArtist, "ForeignArtistId", "foreignArtistId", "id")
    );
    const albumTitle = pickString(item, "Title", "title");

    return {
      id: pickString(item, "Id", "id"),
      title: albumTitle,
      artistName,
      foreignArtistId: resolvedForeignArtistId,
      type: pickString(item, "Type", "type"),
      secondaryTypes: pickStringArray(item, "SecondaryTypes", "secondaryTypes"),
      releaseStatuses: pickStringArray(item, "ReleaseStatuses", "releaseStatuses"),
      images: normalizeImages(item.Images ?? item.images),
      tracks: this.extractAlbumTracksFromPayload(item, {
        artistName,
        albumTitle,
        foreignAlbumId
      })
    };
  }

  private extractAlbumTracksFromPayload(
    payload: Record<string, unknown>,
    context: {
      artistName?: string;
      albumTitle?: string;
      foreignAlbumId: string;
      foreignArtistId?: string;
    }
  ): LidarrSongSearchResult[] {
    const directTracks = Array.isArray(payload.songs)
      ? payload.songs
      : Array.isArray(payload.Songs)
        ? payload.Songs
      : Array.isArray(payload.tracks)
        ? payload.tracks
        : Array.isArray(payload.Tracks)
          ? payload.Tracks
        : [];

    const releaseTracks = Array.isArray(payload.releases)
      ? payload.releases.flatMap((release) => {
          const item = asRecord(release);
          const tracks = item?.Tracks ?? item?.tracks;
          if (Array.isArray(tracks)) {
            return tracks;
          }

          const media = item?.Media ?? item?.media;
          if (!Array.isArray(media)) {
            return [];
          }

          return media.flatMap((medium) => {
            const mediumItem = asRecord(medium);
            const mediumTracks = mediumItem?.Tracks ?? mediumItem?.tracks;
            return Array.isArray(mediumTracks) ? mediumTracks : [];
          });
        })
      : Array.isArray(payload.Releases)
        ? payload.Releases.flatMap((release) => {
            const item = asRecord(release);
            const tracks = item?.Tracks ?? item?.tracks;
            if (Array.isArray(tracks)) {
              return tracks;
            }

            const media = item?.Media ?? item?.media;
            if (!Array.isArray(media)) {
              return [];
            }

            return media.flatMap((medium) => {
              const mediumItem = asRecord(medium);
              const mediumTracks = mediumItem?.Tracks ?? mediumItem?.tracks;
              return Array.isArray(mediumTracks) ? mediumTracks : [];
            });
          })
        : [];

    const rawTracks = directTracks.length > 0 ? directTracks : releaseTracks;

    const normalizedTracks = rawTracks
      .map((song) => {
        const item = asRecord(song);
        if (!item) return null;

        return normalizeSong({
          title: pickString(item, "title", "Title", "trackTitle", "songTitle", "TrackName"),
          artistName:
            pickString(item, "artistName", "ArtistName")
            ?? context.artistName,
          albumTitle:
            pickString(item, "albumTitle", "AlbumTitle")
            ?? context.albumTitle,
          foreignAlbumId:
            pickString(item, "foreignAlbumId", "ForeignAlbumId")
            ?? context.foreignAlbumId,
          foreignSongId:
            pickString(item, "foreignSongId", "ForeignSongId", "foreignTrackId", "ForeignTrackId", "foreignRecordingId", "ForeignRecordingId", "RecordingId", "Id"),
          foreignArtistId:
            pickString(item, "foreignArtistId", "ForeignArtistId")
            ?? context.foreignArtistId,
          duration: pickNumber(item, "duration", "Duration", "durationMs", "DurationMs"),
          trackNumber: pickNumber(item, "trackNumber", "TrackNumber", "TrackPosition")
        });
      })
      .filter((song): song is LidarrSongSearchResult => Boolean(song))
      .map((song) => this.withTransformedImages(song));

    return normalizedTracks.reduce<LidarrSongSearchResult[]>((tracks, track) => {
      const key = trackIdentityKey(track);
      if (!tracks.some((item) => trackIdentityKey(item) === key)) {
        tracks.push(track);
      }
      return tracks;
    }, []).sort((left, right) => (left.trackNumber ?? Number.MAX_SAFE_INTEGER) - (right.trackNumber ?? Number.MAX_SAFE_INTEGER));
  }

  private splitAlbumResultsByGroup(albums: LidarrAlbumSearchResult[]): Pick<LidarrDiscoverSearchResult, "albums" | "singles"> {
    return {
      albums: albums.filter((album) => (album.releaseGroup ?? normalizeReleaseGroup(album.type)) !== "single"),
      singles: albums.filter((album) => (album.releaseGroup ?? normalizeReleaseGroup(album.type)) === "single")
    };
  }

  private splitArtistAlbumsByGroup(albums: LidarrArtistAlbum[]): {
    albums: LidarrArtistAlbum[];
    singles: LidarrArtistAlbum[];
  } {
    return {
      albums: albums.filter((album) => (album.releaseGroup ?? normalizeReleaseGroup(album.type)) !== "single"),
      singles: albums.filter((album) => (album.releaseGroup ?? normalizeReleaseGroup(album.type)) === "single")
    };
  }

  private async enrichDiscoverArtists(artists: LidarrArtistSearchResult[]): Promise<LidarrArtistSearchResult[]> {
    const enriched = await Promise.all(
      artists.map(async (artist, index) => {
        if (!artist.foreignArtistId || index >= 6) {
          return this.withTransformedImages(artist);
        }

        const hydrated = await this.getArtistByForeignId(artist.foreignArtistId, artist.artistName);
        if (!hydrated) {
          return this.withTransformedImages(artist);
        }

        return this.withTransformedImages({
          ...artist,
          overview: firstNonEmptyText(hydrated.overview, artist.overview),
          images: firstImageSet(hydrated.images, artist.images)
        });
      })
    );

    return enriched;
  }

  private async expandAlbumsFromArtists(
    artists: LidarrArtistSearchResult[],
    libraryAlbums: LidarrAlbumSearchResult[],
    rules: LidarrReleaseFilterRules,
    metadataProfileId?: number | null
  ): Promise<LidarrAlbumSearchResult[]> {
    if (artists.length === 0) {
      return [];
    }

    const artistAlbumGroups = await Promise.all(
      artists.slice(0, 3).map(async (artist) => {
        const artistName = artist.artistName?.trim();
        if (!artistName) {
          return [];
        }

        if (artist.foreignArtistId) {
          const groupedReleases = await this.getGroupedReleasesByArtistForeignId(
            artist.foreignArtistId,
            artistName,
            undefined,
            metadataProfileId
          );
          const mergedGroupedReleases = this.mergeAlbumCollections(
            groupedReleases.albums.map(artistAlbumToSearchResult),
            groupedReleases.singles.map(artistAlbumToSearchResult)
          );

          if (mergedGroupedReleases.length > 0) {
            return mergedGroupedReleases;
          }
        }

        const lookupAlbumsRaw = await this.tryRequest<unknown[]>(
          `/api/v1/album/lookup?term=${encodeURIComponent(artistName)}`
        );
        const lookupAlbums = (lookupAlbumsRaw ?? [])
          .map(normalizeAlbum)
          .filter((item): item is LidarrAlbumSearchResult => Boolean(item))
          .filter((album) => matchesArtistIdentity(album, artist.foreignArtistId ?? "", artistName))
          .filter((album) => isReleaseAllowedByRules(album, rules));
        const libraryMatches = libraryAlbums.filter((album) =>
          matchesArtistIdentity(album, artist.foreignArtistId ?? "", artistName)
        ).filter((album) => isReleaseAllowedByRules(album, rules));
        const shouldUsePublicFallback =
          Boolean(artist.foreignArtistId) && lookupAlbums.length === 0 && libraryMatches.length === 0;
        const publicAlbums = shouldUsePublicFallback && artist.foreignArtistId
          ? (await this.getPublicArtistAlbums(artist.foreignArtistId, artistName, rules, true, 24)).map((album) => ({
              title: album.title,
              artistName: album.artistName ?? artistName,
              foreignAlbumId: album.foreignAlbumId,
              foreignArtistId: album.foreignArtistId,
              type: album.type,
              releaseGroup: album.releaseGroup,
              secondaryTypes: album.secondaryTypes,
              releaseStatuses: album.releaseStatuses,
              releaseDate: album.releaseDate,
              images: album.images
            }))
          : [];

        return this.mergeAlbumCollections(lookupAlbums, libraryMatches, publicAlbums);
      })
    );

    return this.mergeAlbumCollections(...artistAlbumGroups);
  }

  private mergeArtistMatches(...matches: Array<LidarrArtistMatch | null | undefined>): LidarrArtist | null {
    const available = matches.filter((match): match is LidarrArtistMatch => Boolean(match));
    if (available.length === 0) return null;

    const preferred = available.find((match) => match.source === "lookup")
      ?? available.find((match) => match.source === "mbid")
      ?? available[0];
    const libraryMatch = available.find((match) => match.source === "library");
    const mbidMatch = available.find((match) => match.source === "mbid");
    const lookupMatch = available.find((match) => match.source === "lookup");

    const merged: LidarrArtist = {
      ...libraryMatch,
      ...mbidMatch,
      ...lookupMatch,
      ...preferred,
      id: libraryMatch?.id ?? mbidMatch?.id ?? preferred.id,
      artistName: firstNonEmptyText(preferred.artistName, lookupMatch?.artistName, mbidMatch?.artistName, libraryMatch?.artistName) ?? preferred.artistName,
      foreignArtistId: firstNonEmptyText(preferred.foreignArtistId, lookupMatch?.foreignArtistId, mbidMatch?.foreignArtistId, libraryMatch?.foreignArtistId),
      overview: firstNonEmptyText(lookupMatch?.overview, mbidMatch?.overview, libraryMatch?.overview),
      images: this.transformImages(firstImageSet(lookupMatch?.images, mbidMatch?.images, libraryMatch?.images))
    };

    return merged;
  }

  private async getLookupArtistMatch(foreignArtistId: string, searchTerm: string): Promise<LidarrArtistMatch | null> {
    const exactMatch = await this.getExactArtistLookupMatch(foreignArtistId);
    if (exactMatch) {
      return exactMatch;
    }

    const encoded = encodeURIComponent(searchTerm);
    const searchResults = await this.tryRequest<LidarrArtist[]>(`/api/v1/artist/lookup?term=${encoded}`);
    if (this.debug) console.log("[lidarr] getLookupArtistMatch - search results for:", searchTerm, "count:", searchResults?.length ?? 0);

    if (!searchResults || searchResults.length === 0) {
      return null;
    }

    const fallbackMatch = searchResults.find((artist) => artistSearchMatches(artist, foreignArtistId, searchTerm));
    if (!fallbackMatch) {
      return null;
    }

    return {
      ...fallbackMatch,
      source: "lookup"
    };
  }

  private makeImageUrl(relativePath: string | undefined): string | undefined {
    if (!relativePath) return undefined;
    if (relativePath.startsWith("http")) return relativePath;
    return `${this.baseUrl}${relativePath}`;
  }

  private transformImages(images: LidarrImage[] | undefined): LidarrImage[] | undefined {
    if (!images || images.length === 0) return undefined;
    return images.map((img) => ({
      ...img,
      url: this.makeImageUrl(img.url),
      remoteUrl: this.makeImageUrl(img.remoteUrl)
    }));
  }

  async healthCheck(): Promise<void> {
    await this.request<Record<string, unknown>>("/api/v1/system/status");
  }

  async searchArtists(term: string): Promise<LidarrArtistSearchResult[]> {
    const encoded = encodeURIComponent(term);
    const results = await this.request<LidarrArtistSearchResult[]>(`/api/v1/artist/lookup?term=${encoded}`);
    const normalizedTerm = normalizeText(term);
    const sorted = [...results].sort((left, right) => {
      const leftName = normalizeText(left.artistName);
      const rightName = normalizeText(right.artistName);
      const leftExact = leftName === normalizedTerm ? 1 : 0;
      const rightExact = rightName === normalizedTerm ? 1 : 0;
      if (leftExact !== rightExact) {
        return rightExact - leftExact;
      }

      const leftPrefix = leftName?.startsWith(normalizedTerm ?? "") ? 1 : 0;
      const rightPrefix = rightName?.startsWith(normalizedTerm ?? "") ? 1 : 0;
      if (leftPrefix !== rightPrefix) {
        return rightPrefix - leftPrefix;
      }

      return (left.artistName ?? "").localeCompare(right.artistName ?? "");
    });

    return filterArtistSearchResults(sorted, term).map((artist) => this.withTransformedImages(artist));
  }

  async searchDiscover(term: string, metadataProfileId?: number | null): Promise<LidarrDiscoverSearchResult> {
    return this.fromCache(
      `discover:${normalizeText(term) ?? term}:${metadataProfileId ?? "default"}`,
      LidarrClient.searchCacheTtlMs,
      async () => {
        const encoded = encodeURIComponent(term);
        const rules = await this.getReleaseFilterRules(metadataProfileId);

        const [artists, albumsRaw, libraryAlbumsRaw] = await Promise.all([
          this.searchArtists(term),
          this.tryRequest<unknown[]>(`/api/v1/album/lookup?term=${encoded}`),
          this.getAllAlbums()
        ]);

        const lookupAlbums = (albumsRaw ?? [])
          .map(normalizeAlbum)
          .filter((item): item is LidarrAlbumSearchResult => Boolean(item));
        const libraryAlbums = (libraryAlbumsRaw ?? [])
          .map(normalizeAlbum)
          .filter((item): item is LidarrAlbumSearchResult => Boolean(item));
        const artistExpandedAlbums = await this.expandAlbumsFromArtists(artists, libraryAlbums, rules, metadataProfileId);
        const enrichedArtists = await this.enrichDiscoverArtists(artists);
        const strongArtistMatches = artists.filter((artist) => {
          const normalizedArtist = normalizeText(artist.artistName);
          const normalizedTerm = normalizeText(term);
          if (!normalizedArtist || !normalizedTerm) {
            return false;
          }

          return normalizedArtist === normalizedTerm || normalizedArtist.startsWith(normalizedTerm);
        });
        const artistScopedAlbums = strongArtistMatches.length > 0
          ? lookupAlbums.filter((album) =>
              strongArtistMatches.some((artist) =>
                matchesArtistIdentity(album, artist.foreignArtistId ?? "", artist.artistName)
              )
            ).filter((album) => isReleaseAllowedByRules(album, rules))
          : lookupAlbums;
        const libraryAlbumsMatchingTerm = libraryAlbums.filter((album) => {
          if (!matchesAlbumSearchTerm(album, term)) {
            return false;
          }

          return strongArtistMatches.length === 0
            ? true
            : strongArtistMatches.some((artist) =>
                matchesArtistIdentity(album, artist.foreignArtistId ?? "", artist.artistName)
              );
        }).filter((album) => isReleaseAllowedByRules(album, rules));
        const releases = await this.hydrateDiscoverAlbumResults(
          this.mergeAlbumCollections(
          artistScopedAlbums,
          artistExpandedAlbums,
          libraryAlbumsMatchingTerm
          )
        );
        const { albums, singles } = this.splitAlbumResultsByGroup(releases);

        return {
          artists: enrichedArtists,
          albums,
          singles
        };
      }
    );
  }

  private async getAllArtists(): Promise<LidarrArtist[]> {
    const result = await this.fromCache(
      "artists",
      LidarrClient.libraryCacheTtlMs,
      async () => this.tryRequest<LidarrArtist[]>("/api/v1/artist")
    );
    return result ?? [];
  }

  async getExistingArtistByForeignId(foreignArtistId: string): Promise<LidarrArtist | null> {
    const all = await this.getAllArtists();
    const match = all.find((artist) => artist.foreignArtistId === foreignArtistId);
    if (this.debug && match) {
      console.log("[lidarr] getExistingArtistByForeignId - found:", match.artistName);
    }
    return match ?? null;
  }

  async getExistingAlbumByForeignId(foreignAlbumId: string): Promise<LidarrAlbum | null> {
    const all = await this.getAllAlbums();
    return all.find((album) => album.foreignAlbumId === foreignAlbumId) ?? null;
  }

  async getArtistByForeignId(foreignArtistId: string, artistName?: string): Promise<LidarrArtist | null> {
    const existingArtist = await this.getExistingArtistByForeignId(foreignArtistId);
    if (this.debug) console.log("[lidarr] getArtistByForeignId - existing artist:", existingArtist ? { id: existingArtist.id, name: existingArtist.artistName, hasOverview: !!existingArtist.overview, imagesCount: existingArtist.images?.length } : null);

    const [mbidLookupRaw, lookupByExistingName, lookupByRequestedName] = await Promise.all([
      this.tryRequest<LidarrArtist>(`/api/v1/artist/mbid/${foreignArtistId}`),
      existingArtist?.artistName ? this.getLookupArtistMatch(foreignArtistId, existingArtist.artistName) : Promise.resolve(null),
      artistName && artistName !== existingArtist?.artistName ? this.getLookupArtistMatch(foreignArtistId, artistName) : Promise.resolve(null)
    ]);

    const localArtist = this.mergeArtistMatches(
      existingArtist ? { ...existingArtist, source: "library" } : null,
      mbidLookupRaw ? { ...mbidLookupRaw, source: "mbid" } : null,
      lookupByExistingName,
      lookupByRequestedName
    );

    const shouldFetchPublicArtist =
      !localArtist ||
      !firstNonEmptyText(localArtist.overview) ||
      !firstImageSet(localArtist.images);
    const publicArtistProfile = shouldFetchPublicArtist
      ? await this.getPublicArtistProfile(foreignArtistId)
      : null;

    if (!localArtist && !publicArtistProfile) {
      return null;
    }

    const mergedArtist: LidarrArtist = {
      ...(localArtist ?? {
        id: 0,
        artistName: publicArtistProfile?.artistName ?? artistName ?? foreignArtistId
      }),
      artistName: firstNonEmptyText(localArtist?.artistName, publicArtistProfile?.artistName, artistName) ?? foreignArtistId,
      foreignArtistId: firstNonEmptyText(localArtist?.foreignArtistId, publicArtistProfile?.id, foreignArtistId),
      overview: firstNonEmptyText(localArtist?.overview, publicArtistProfile?.overview),
      images: this.transformImages(firstImageSet(publicArtistProfile?.images, localArtist?.images))
    };

    if (this.debug) console.log("[lidarr] getArtistByForeignId - merged artist:", { name: mergedArtist.artistName, hasOverview: !!mergedArtist.overview, imagesCount: mergedArtist.images?.length });
    return mergedArtist;
  }

  async getAlbumsByArtistForeignId(
    foreignArtistId: string,
    artistName?: string,
    existingArtist?: LidarrArtist | null,
    metadataProfileId?: number | null
  ): Promise<LidarrArtistAlbum[]> {
    const artist = existingArtist ?? await this.getArtistByForeignId(foreignArtistId, artistName);
    const artistInternalId = artist?.id;
    const rules = await this.getReleaseFilterRules(metadataProfileId);

    if (this.debug) console.log("[lidarr] getAlbumsByArtistForeignId - artistName:", artistName, "artistInternalId:", artistInternalId);

    const [allAlbumsRaw, searchAlbumsRaw] = await Promise.all([
      this.tryRequest<unknown[]>("/api/v1/album"),
      artistName
        ? this.tryRequest<unknown[]>(`/api/v1/album/lookup?term=${encodeURIComponent(artistName)}`)
        : Promise.resolve(null)
    ]);
    const allAlbums = (allAlbumsRaw ?? [])
      .map(normalizeArtistAlbum)
      .filter((album): album is LidarrArtistAlbum => Boolean(album));
    const searchAlbums = (searchAlbumsRaw ?? [])
      .map(normalizeArtistAlbum)
      .filter((album): album is LidarrArtistAlbum => Boolean(album));

    const libraryMatches = allAlbums.filter((album) => {
      if (artistInternalId && album.artistId === artistInternalId) {
        return true;
      }

      return matchesArtistIdentity(album, foreignArtistId, artistName ?? artist?.artistName);
    });

    const lookupMatches = searchAlbums.filter((album) =>
      matchesArtistIdentity(album, foreignArtistId, artistName ?? artist?.artistName)
    ).filter((album) =>
      isReleaseAllowedByRules({
        type: album.type,
        secondaryTypes: album.secondaryTypes,
        releaseStatuses: album.releaseStatuses
      }, rules)
    );
    const publicMatches = await this.getPublicArtistAlbums(
      foreignArtistId,
      artistName ?? artist?.artistName,
      rules,
      true,
      48
    );

    const merged = this.mergeArtistAlbumCollections(lookupMatches, libraryMatches, publicMatches).filter((album) =>
      isReleaseAllowedByRules({
        type: album.type,
        secondaryTypes: album.secondaryTypes,
        releaseStatuses: album.releaseStatuses
      }, rules)
    );

    if (this.debug) console.log("[lidarr] getAlbumsByArtistForeignId - merged results:", merged.length);

    return merged.map((album) => this.withTransformedImages(album));
  }

  async getGroupedReleasesByArtistForeignId(
    foreignArtistId: string,
    artistName?: string,
    existingArtist?: LidarrArtist | null,
    metadataProfileId?: number | null
  ): Promise<{ albums: LidarrArtistAlbum[]; singles: LidarrArtistAlbum[] }> {
    const releases = await this.getAlbumsByArtistForeignId(
      foreignArtistId,
      artistName,
      existingArtist,
      metadataProfileId
    );
    const grouped = this.splitArtistAlbumsByGroup(releases);

    return {
      albums: await this.hydrateArtistAlbumCollectionImages(grouped.albums, grouped.albums.length),
      singles: await this.hydrateArtistAlbumCollectionImages(grouped.singles, grouped.singles.length)
    };
  }

  async getAlbumByForeignId(foreignAlbumId: string, artistNameHint?: string): Promise<LidarrArtistAlbum | null> {
    const exactLookup = await this.getExactAlbumLookup(foreignAlbumId);
    if (exactLookup && hasUsableImageSet(exactLookup.images)) {
      return exactLookup;
    }

    // First check if album exists in library
    const existingAlbum = await this.getExistingAlbumByForeignId(foreignAlbumId);
    if (this.debug) console.log("[lidarr] getAlbumByForeignId - existing album:", existingAlbum ? { id: existingAlbum.id, title: existingAlbum.title } : null);

    // Try search endpoint using album title for fresh metadata
    const searchTerms = [
      firstNonEmptyText(
        exactLookup?.title && firstNonEmptyText(artistNameHint, exactLookup.artistName) ? `${firstNonEmptyText(artistNameHint, exactLookup.artistName)} ${exactLookup.title}` : undefined,
        existingAlbum?.title && artistNameHint ? `${artistNameHint} ${existingAlbum.title}` : undefined,
        exactLookup?.title,
        existingAlbum?.title,
        artistNameHint
      ),
      foreignAlbumId
    ].filter((value, index, list): value is string => Boolean(value) && list.indexOf(value) === index);

    for (const searchTerm of searchTerms) {
      const encoded = encodeURIComponent(searchTerm);
      const searchPayload = await this.tryRequest<unknown>(`/api/v1/album/lookup?term=${encoded}`);
      const searchResults = Array.isArray(searchPayload)
        ? searchPayload
        : searchPayload
          ? [searchPayload]
          : [];

      if (this.debug) {
        console.log("[lidarr] getAlbumByForeignId - search results:", searchResults.length, "albums for", searchTerm);
      }

      const match = searchResults
        .map(normalizeArtistAlbum)
        .filter((album): album is LidarrArtistAlbum => Boolean(album))
        .find((album) =>
        matchesAlbumIdentity(
          album,
          foreignAlbumId,
          existingAlbum?.title,
          artistNameHint ?? existingAlbum?.artist?.artistName,
          existingAlbum?.artist?.foreignArtistId
        )
      );
      if (this.debug) {
        console.log("[lidarr] getAlbumByForeignId - matched album:", match ? { title: match.title, imagesCount: match.images?.length } : null);
      }
      if (match) {
        return this.withTransformedImages(exactLookup ? mergeArtistAlbums(match, exactLookup) : match);
      }
    }

    // Fallback: return existing album
    if (this.debug) console.log("[lidarr] getAlbumByForeignId - using existing album fallback:", existingAlbum ? { id: existingAlbum.id, title: existingAlbum.title } : null);
    return existingAlbum
      ? {
          ...existingAlbum,
          artistName: existingAlbum.artist?.artistName,
          foreignArtistId: existingAlbum.artist?.foreignArtistId,
          images: this.transformImages(existingAlbum.images)
        }
      : exactLookup;
  }

  async getAlbumTracks(foreignAlbumId: string, artistNameHint?: string): Promise<LidarrSongSearchResult[]> {
    const existingAlbum = await this.getExistingAlbumByForeignId(foreignAlbumId);
    if (this.debug) console.log("[lidarr] getAlbumTracks - existing album:", existingAlbum ? { id: existingAlbum.id, title: existingAlbum.title } : null);

    let artistName: string | undefined;
    let albumTitle: string | undefined;
    let albumId: number | undefined;
    const exactAlbumPayload = !existingAlbum ? await this.getExactAlbumLookupPayload(foreignAlbumId) : null;

    if (existingAlbum) {
      artistName = existingAlbum.artist?.artistName;
      albumTitle = existingAlbum.title;
      albumId = existingAlbum.id;
    } else if (exactAlbumPayload) {
      const exactArtist = asRecord(exactAlbumPayload.artist);
      artistName = pickString(exactAlbumPayload, "artistName") ?? pickString(exactArtist, "artistName", "name");
      albumTitle = pickString(exactAlbumPayload, "title", "albumTitle");
    }

    if (!existingAlbum) {
      const publicAlbum = await this.getPublicAlbumProfile(foreignAlbumId);
      if (publicAlbum?.tracks.length) {
        return publicAlbum.tracks;
      }

      artistName = firstNonEmptyText(artistName, publicAlbum?.artistName, artistNameHint);
      albumTitle = firstNonEmptyText(albumTitle, publicAlbum?.title);
    }

    // Try to get album info to find artist name and album title for better search
    if (!artistName || !albumTitle || !albumId) {
      const albumInfo = await this.getAlbumByForeignId(foreignAlbumId, artistNameHint);
      if (albumInfo) {
        artistName = albumInfo.artistName ?? albumInfo.artist?.artistName;
        albumTitle = albumInfo.title;
        albumId = albumInfo.id;
        if (this.debug) console.log("[lidarr] getAlbumTracks - album info:", { artistName, albumTitle, albumId });
      }
    }

    if (exactAlbumPayload) {
      const normalizedSongs = this.extractAlbumTracksFromPayload(exactAlbumPayload, {
        artistName,
        albumTitle,
        foreignAlbumId,
        foreignArtistId: pickString(asRecord(exactAlbumPayload.artist), "foreignArtistId")
      });
      if (normalizedSongs.length > 0) {
        return normalizedSongs;
      }
    }

    // Try /api/v1/tracks endpoint with albumId
    if (albumId) {
      if (this.debug) console.log("[lidarr] getAlbumTracks - trying tracks endpoint with albumId:", albumId);
      const tracksResponse = await this.tryRequest<unknown[]>(`/api/v1/track?albumId=${albumId}`);
      if (this.debug) console.log("[lidarr] getAlbumTracks - tracks endpoint response:", tracksResponse?.length ?? 0);

      if (tracksResponse && tracksResponse.length > 0) {
        const tracks = tracksResponse
          .map((t) => {
            const item = asRecord(t);
            if (!item) return null;
            return normalizeSong({
              title: pickString(item, "title"),
              artistName: pickString(item, "artistName") ?? artistName,
              albumTitle: pickString(item, "albumTitle") ?? albumTitle,
              foreignAlbumId: pickString(item, "foreignAlbumId"),
              foreignSongId: pickString(item, "foreignSongId", "foreignTrackId"),
              foreignArtistId: pickString(item, "foreignArtistId"),
              duration: pickNumber(item, "duration", "durationMs"),
              trackNumber: pickNumber(item, "trackNumber")
            });
          })
          .filter((t): t is LidarrSongSearchResult => t !== null)
          .map((track) => this.withTransformedImages(track));

        if (tracks.length > 0) {
          if (this.debug) console.log("[lidarr] getAlbumTracks - found tracks from tracks endpoint:", tracks.length);
          return tracks;
        }
      }
    }

    // Try multiple search strategies
    const searchTerms: string[] = [];

    if (artistName && albumTitle) {
      searchTerms.push(`${artistName} ${albumTitle}`);
    }

    // 1. Try with album title if we have it
    if (albumTitle) {
      searchTerms.push(albumTitle);
    }

    // 2. Try with foreignAlbumId (might work for some IDs)
    searchTerms.push(foreignAlbumId);

    for (const term of [...new Set(searchTerms)]) {
      const encoded = encodeURIComponent(term);

      // Try song/lookup endpoint
      const songs = await this.tryRequest<LidarrSongSearchResult[]>(`/api/v1/song/lookup?term=${encoded}`);
      if (this.debug) console.log(`[lidarr] getAlbumTracks - song lookup with "${term}":`, songs?.length ?? 0);

      if (songs && songs.length > 0) {
        const matchingTracks = songs.filter((song) =>
          matchesSongToAlbum(song, foreignAlbumId, albumTitle, artistName)
        );

        if (matchingTracks.length > 0) {
          if (this.debug) console.log("[lidarr] getAlbumTracks - filtered tracks:", matchingTracks.length);
          return matchingTracks;
        }
      }

      // Try album lookup endpoint
      const albumLookupPayload = await this.tryRequest<unknown>(`/api/v1/album/lookup?term=${encoded}`);
      const albumCandidates = Array.isArray(albumLookupPayload)
        ? albumLookupPayload
        : albumLookupPayload
          ? [albumLookupPayload]
          : [];
      if (this.debug) console.log(`[lidarr] getAlbumTracks - album lookup with "${term}":`, { albumCount: albumCandidates.length });

      for (const candidate of albumCandidates) {
        const item = asRecord(candidate);
        if (!item) {
          continue;
        }

        const candidateArtist = asRecord(item.artist);
        const candidateAlbum = normalizeArtistAlbum(item);
        if (
          candidateAlbum
          && !matchesAlbumIdentity(
            candidateAlbum,
            foreignAlbumId,
            albumTitle,
            artistName,
            pickString(candidateArtist, "foreignArtistId")
          )
        ) {
          continue;
        }

        const matchingTracks = this.extractAlbumTracksFromPayload(item, {
          artistName:
            artistName
            ?? pickString(item, "artistName")
            ?? pickString(candidateArtist, "artistName", "name"),
          albumTitle:
            albumTitle
            ?? pickString(item, "title", "albumTitle"),
          foreignAlbumId,
          foreignArtistId:
            pickString(item, "foreignArtistId")
            ?? pickString(candidateArtist, "foreignArtistId")
        });
        if (matchingTracks.length > 0) {
          return matchingTracks;
        }
      }
    }

    if (existingAlbum) {
      const publicAlbum = await this.getPublicAlbumProfile(foreignAlbumId);
      if (publicAlbum?.tracks.length) {
        return publicAlbum.tracks;
      }
    }

    return [];
  }

  isAlbumFullyAvailable(
    album: { statistics?: LidarrAlbumStatistics | undefined },
    fallbackFileCount?: number
  ): boolean {
    const trackFileCount = album.statistics?.trackFileCount;
    const totalTrackCount = album.statistics?.trackCount ?? album.statistics?.totalTrackCount;
    const percentOfTracks = album.statistics?.percentOfTracks;

    if (typeof trackFileCount === "number" && typeof totalTrackCount === "number" && totalTrackCount > 0) {
      return trackFileCount >= totalTrackCount;
    }

    if (typeof percentOfTracks === "number") {
      return percentOfTracks >= 100;
    }

    return (fallbackFileCount ?? 0) > 0;
  }

  async getAlbumFileCounts(albumIds: number[]): Promise<Record<number, number>> {
    const uniqueAlbumIds = [...new Set(albumIds.filter((albumId) => Number.isFinite(albumId)))];

    const counts = await Promise.all(
      uniqueAlbumIds.map(async (albumId) => {
        const trackfiles = await this.tryRequest<unknown[]>(`/api/v1/trackfile?albumId=${albumId}`);
        return [albumId, trackfiles?.length ?? 0] as const;
      })
    );

    return Object.fromEntries(counts);
  }

  async getAllAlbums(): Promise<LidarrAlbum[]> {
    const result = await this.fromCache(
      "albums",
      LidarrClient.libraryCacheTtlMs,
      async () => this.tryRequest<LidarrAlbum[]>("/api/v1/album")
    );
    return result ?? [];
  }

  async isAvailable(): Promise<boolean> {
    const result = await this.tryRequest<unknown[]>(
      "/api/v1/system/status",
      this.getTimeoutInit()
    );
    return result !== null;
  }

  async getArtistById(artistId: number): Promise<LidarrArtist | null> {
    if (!artistId || artistId <= 0) {
      return null;
    }

    return this.tryRequest<LidarrArtist>(`/api/v1/artist/${artistId}`);
  }

  async getAlbumById(albumId: number): Promise<LidarrAlbum | null> {
    if (!albumId || albumId <= 0) {
      return null;
    }

    return this.tryRequest<LidarrAlbum>(`/api/v1/album/${albumId}`);
  }

  albumNeedsFileCountFallback(album: { statistics?: LidarrAlbumStatistics | undefined }): boolean {
    const trackFileCount = album.statistics?.trackFileCount;
    const totalTrackCount = album.statistics?.trackCount ?? album.statistics?.totalTrackCount;
    const percentOfTracks = album.statistics?.percentOfTracks;

    return !(
      (typeof trackFileCount === "number" && typeof totalTrackCount === "number" && totalTrackCount > 0)
      || typeof percentOfTracks === "number"
    );
  }

  async getExistingArtistAlbums(foreignArtistId: string): Promise<LidarrArtistAlbum[]> {
    // Check all albums in library regardless of whether artist was added
    const allAlbums = await this.request<LidarrArtistAlbum[]>("/api/v1/album");
    if (this.debug) console.log("[lidarr] getExistingArtistAlbums - all albums in library:", allAlbums?.length ?? 0, "checking for foreignArtistId:", foreignArtistId);

    const filtered = allAlbums.filter((album) => album.foreignArtistId === foreignArtistId);
    if (this.debug) console.log("[lidarr] getExistingArtistAlbums - matched albums:", filtered.length);

    return filtered;
  }

  async getAlbumsByArtistId(artistId: number): Promise<LidarrArtistAlbum[]> {
    if (!Number.isFinite(artistId) || artistId <= 0) {
      return [];
    }

    const payload = await this.tryRequest<unknown[]>(`/api/v1/album?artistId=${artistId}`);
    return (payload ?? [])
      .map((entry) => normalizeArtistAlbum(entry))
      .filter((entry): entry is LidarrArtistAlbum => Boolean(entry))
      .map((entry) => this.withTransformedImages(entry));
  }

  async addArtist(input: AddArtistInput): Promise<LidarrArtist> {
    const createdArtist = await this.request<LidarrArtist>("/api/v1/artist", {
      method: "POST",
      body: JSON.stringify({
        artistName: input.artistName,
        foreignArtistId: input.foreignArtistId,
        qualityProfileId: input.qualityProfileId,
        metadataProfileId: input.metadataProfileId,
        rootFolderPath: input.rootFolderPath,
        monitored: input.monitored ?? true,
        addOptions: {
          monitor: input.monitorMode,
          searchForMissingAlbums: input.searchForMissingAlbums ?? true
        }
      })
    });

    await this.invalidateCaches();
    return createdArtist;
  }

  async addAlbum(input: AddAlbumInput): Promise<LidarrAlbum> {
    const lookupPayload = input.foreignAlbumId
      ? await this.getExactAlbumLookupPayload(input.foreignAlbumId)
      : null;

    if (input.foreignAlbumId && !lookupPayload) {
      throw new Error("Album not found");
    }

    const payloadArtist = lookupPayload ? asRecord(lookupPayload.artist) : null;
    const resolvedArtistId = firstPositiveNumber(
      input.artistId,
      pickNumber(lookupPayload, "artistId"),
      pickNumber(payloadArtist, "id")
    );
    const resolvedQualityProfileId = firstPositiveNumber(
      input.qualityProfileId,
      pickNumber(lookupPayload, "qualityProfileId"),
      pickNumber(payloadArtist, "qualityProfileId")
    );
    const resolvedMetadataProfileId = firstPositiveNumber(
      input.metadataProfileId,
      pickNumber(lookupPayload, "metadataProfileId"),
      pickNumber(payloadArtist, "metadataProfileId")
    );
    const resolvedRootFolderPath = firstNonEmptyText(
      input.rootFolderPath,
      pickString(lookupPayload, "rootFolderPath"),
      pickString(payloadArtist, "rootFolderPath")
    );
    const body = lookupPayload
      ? compactRecord({
          ...lookupPayload,
          qualityProfileId: resolvedQualityProfileId,
          metadataProfileId: resolvedMetadataProfileId,
          rootFolderPath: resolvedRootFolderPath,
          artistId: resolvedArtistId,
          artist: compactRecord({
            ...(payloadArtist ?? {}),
            id: resolvedArtistId,
            artistName: input.artistName || pickString(payloadArtist, "artistName", "name"),
            foreignArtistId:
              input.foreignArtistId
              ?? pickString(payloadArtist, "foreignArtistId")
              ?? pickString(lookupPayload, "foreignArtistId"),
            qualityProfileId: resolvedQualityProfileId,
            metadataProfileId: resolvedMetadataProfileId,
            rootFolderPath: resolvedRootFolderPath
          }),
          monitored: true
        })
      : compactRecord({
          title: input.albumTitle,
          foreignAlbumId: input.foreignAlbumId,
          qualityProfileId: resolvedQualityProfileId,
          metadataProfileId: resolvedMetadataProfileId,
          rootFolderPath: resolvedRootFolderPath,
          artistId: resolvedArtistId,
          artist: compactRecord({
            id: resolvedArtistId,
            artistName: input.artistName,
            foreignArtistId: input.foreignArtistId,
            qualityProfileId: resolvedQualityProfileId,
            metadataProfileId: resolvedMetadataProfileId,
            rootFolderPath: resolvedRootFolderPath
          }),
          monitored: true
        });

    try {
      const createdAlbum = await this.request<LidarrAlbum>("/api/v1/album", {
        method: "POST",
        body: JSON.stringify(body)
      });

      await this.invalidateCaches();
      return createdAlbum;
    } catch (error) {
      if (
        input.foreignAlbumId
        && error instanceof Error
        && error.message.includes("UNIQUE constraint failed: Albums.ForeignAlbumId")
      ) {
        const existingAlbum = await this.getExistingAlbumByForeignId(input.foreignAlbumId);
        if (existingAlbum) {
          return existingAlbum;
        }
      }

      throw error;
    }
  }

  async triggerAlbumSearch(albumIds: number[]): Promise<void> {
    const uniqueAlbumIds = [...new Set(albumIds.filter((albumId) => Number.isFinite(albumId) && albumId > 0))];
    if (uniqueAlbumIds.length === 0) {
      return;
    }

    await this.request<Record<string, unknown>>("/api/v1/command", {
      method: "POST",
      body: JSON.stringify({
        name: "AlbumSearch",
        albumIds: uniqueAlbumIds
      })
    });
  }

  async setAlbumsMonitored(albumIds: number[], monitored: boolean = true): Promise<void> {
    const uniqueAlbumIds = [...new Set(albumIds.filter((albumId) => Number.isFinite(albumId) && albumId > 0))];
    if (uniqueAlbumIds.length === 0) {
      return;
    }

    await this.request<unknown>("/api/v1/album/monitor", {
      method: "PUT",
      body: JSON.stringify({
        albumIds: uniqueAlbumIds,
        monitored
      })
    });

    await this.invalidateCaches();
  }

  async deleteAlbum(albumId: number, deleteFiles: boolean = true): Promise<void> {
    await this.request<Record<string, unknown>>(
      `/api/v1/album/${albumId}?deleteFiles=${deleteFiles ? "true" : "false"}&addImportListExclusion=false`,
      {
        method: "DELETE"
      }
    );
    await this.invalidateCaches();
  }

  async deleteArtist(artistId: number, deleteFiles: boolean = true): Promise<void> {
    await this.request<Record<string, unknown>>(
      `/api/v1/artist/${artistId}?deleteFiles=${deleteFiles ? "true" : "false"}&addImportListExclusion=false`,
      {
        method: "DELETE"
      }
    );
    await this.invalidateCaches();
  }
}
