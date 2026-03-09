export type LidarrImage = {
  coverType?: string;
  remoteUrl?: string;
  url?: string;
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
  images?: LidarrImage[];
};

export type LidarrDiscoverSearchResult = {
  artists: LidarrArtistSearchResult[];
  albums: LidarrAlbumSearchResult[];
  songs: LidarrSongSearchResult[];
};

type LidarrArtist = {
  id: number;
  artistName: string;
  foreignArtistId?: string;
  metadataProfileId?: number;
  qualityProfileId?: number;
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
  releaseDate?: string;
  images?: LidarrImage[];
};

type LidarrAlbum = {
  id: number;
  title: string;
  foreignAlbumId?: string;
  artist?: {
    artistName?: string;
    foreignArtistId?: string;
  };
};

type AddArtistInput = {
  artistName: string;
  foreignArtistId?: string;
  mbid?: string;
  qualityProfileId: number;
  metadataProfileId?: number;
  rootFolderPath: string;
  monitorMode: string;
};

type AddAlbumInput = {
  albumTitle: string;
  artistName: string;
  foreignAlbumId?: string;
  foreignArtistId?: string;
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

const normalizeImages = (value: unknown): LidarrImage[] | undefined => {
  if (!Array.isArray(value)) return undefined;

  const images = value
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => ({
      coverType: pickString(item, "coverType"),
      remoteUrl: pickString(item, "remoteUrl"),
      url: pickString(item, "url")
    }));

  return images.length > 0 ? images : undefined;
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
    overview: pickString(item, "overview"),
    images: normalizeImages(item.images ?? artist?.images)
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
    title,
    artistName,
    albumTitle: pickString(item, "albumTitle") ?? pickString(album, "title", "albumTitle"),
    foreignAlbumId: pickString(item, "foreignAlbumId") ?? pickString(album, "foreignAlbumId"),
    foreignSongId: pickString(item, "foreignSongId", "foreignTrackId", "foreignRecordingId"),
    foreignArtistId: pickString(item, "foreignArtistId") ?? pickString(artist, "foreignArtistId"),
    duration: pickNumber(item, "duration", "durationMs"),
    images: normalizeImages(item.images ?? album?.images ?? artist?.images)
  };
};

export class LidarrClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string
  ) {}

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

  private async tryRequest<T>(path: string): Promise<T | null> {
    try {
      return await this.request<T>(path);
    } catch {
      return null;
    }
  }

  async healthCheck(): Promise<void> {
    await this.request<Record<string, unknown>>("/api/v1/system/status");
  }

  async searchArtists(term: string): Promise<LidarrArtistSearchResult[]> {
    const encoded = encodeURIComponent(term);
    return this.request<LidarrArtistSearchResult[]>(`/api/v1/artist/lookup?term=${encoded}`);
  }

  async searchDiscover(term: string): Promise<LidarrDiscoverSearchResult> {
    const encoded = encodeURIComponent(term);

    const [artists, albumsRaw, songsRaw, tracksRaw] = await Promise.all([
      this.searchArtists(term),
      this.tryRequest<unknown[]>(`/api/v1/album/lookup?term=${encoded}`),
      this.tryRequest<unknown[]>(`/api/v1/song/lookup?term=${encoded}`),
      this.tryRequest<unknown[]>(`/api/v1/track/lookup?term=${encoded}`)
    ]);

    const albums = (albumsRaw ?? []).map(normalizeAlbum).filter((item): item is LidarrAlbumSearchResult => Boolean(item));

    const songsSource = songsRaw && songsRaw.length > 0 ? songsRaw : tracksRaw ?? [];
    const songs = songsSource
      .map(normalizeSong)
      .filter((item): item is LidarrSongSearchResult => Boolean(item));

    return {
      artists,
      albums,
      songs
    };
  }

  async getExistingArtistByForeignId(foreignArtistId: string): Promise<LidarrArtist | null> {
    const encoded = encodeURIComponent(foreignArtistId);

    try {
      const results = await this.request<LidarrArtist[]>(`/api/v1/artist?foreignArtistId=${encoded}`);
      if (results.length > 0) return results[0];
    } catch {
      // Some Lidarr versions may not support this query param.
    }

    const all = await this.request<LidarrArtist[]>("/api/v1/artist");
    return all.find((artist) => artist.foreignArtistId === foreignArtistId) ?? null;
  }

  async getExistingAlbumByForeignId(foreignAlbumId: string): Promise<LidarrAlbum | null> {
    const encoded = encodeURIComponent(foreignAlbumId);

    try {
      const results = await this.request<LidarrAlbum[]>(`/api/v1/album?foreignAlbumId=${encoded}`);
      if (results.length > 0) return results[0];
    } catch {
      // Some Lidarr versions may not support this query param.
    }

    const all = await this.request<LidarrAlbum[]>("/api/v1/album");
    return all.find((album) => album.foreignAlbumId === foreignAlbumId) ?? null;
  }

  async getArtistByForeignId(foreignArtistId: string): Promise<LidarrArtist | null> {
    // First try: check if artist is already in the library
    const existingArtist = await this.getExistingArtistByForeignId(foreignArtistId);
    console.log("[lidarr] getArtistByForeignId - existing artist:", existingArtist ? { id: existingArtist.id, name: existingArtist.artistName, imagesCount: existingArtist.images?.length } : null);
    if (existingArtist) return existingArtist;

    // Second try: search by term using the foreignArtistId
    const encoded = encodeURIComponent(foreignArtistId);
    const searchResults = await this.tryRequest<LidarrArtist[]>(`/api/v1/artist/lookup?term=${encoded}`);
    console.log("[lidarr] getArtistByForeignId - search results:", searchResults?.length ?? 0, "artists");

    // Filter results to find matching artist by foreignArtistId
    if (searchResults && searchResults.length > 0) {
      const match = searchResults.find((a) => a.foreignArtistId === foreignArtistId);
      console.log("[lidarr] getArtistByForeignId - matched artist:", match ? { name: match.artistName, imagesCount: match.images?.length } : null);
      if (match) return match;
      // Return first result if no exact match
      return searchResults[0];
    }

    return null;
  }

  async getAlbumsByArtistForeignId(foreignArtistId: string): Promise<LidarrArtistAlbum[]> {
    // First try: search by term
    const encoded = encodeURIComponent(foreignArtistId);
    let albums = await this.tryRequest<LidarrArtistAlbum[]>(`/api/v1/album/lookup?term=${encoded}`);
    console.log("[lidarr] getAlbumsByArtistForeignId - search results:", albums?.length ?? 0, "albums");

    // Filter to only albums matching the foreignArtistId
    if (albums && albums.length > 0) {
      const matching = albums.filter((a) => a.foreignArtistId === foreignArtistId);
      console.log("[lidarr] getAlbumsByArtistForeignId - filtered by foreignArtistId:", matching.length, "albums");
      if (matching.length > 0) return matching;
    }

    if (!albums || albums.length === 0) {
      console.log("[lidarr] getAlbumsByArtistForeignId - no albums from search, trying fallback");
      // Fallback: search by artist name in existing albums
      const artist = await this.getArtistByForeignId(foreignArtistId);
      if (!artist) {
        console.log("[lidarr] getAlbumsByArtistForeignId - no artist found for fallback");
        return [];
      }

      console.log("[lidarr] getAlbumsByArtistForeignId - fallback artist:", artist.artistName);
      const allAlbums = await this.tryRequest<LidarrArtistAlbum[]>("/api/v1/album");
      console.log("[lidarr] getAlbumsByArtistForeignId - all albums in library:", allAlbums?.length ?? 0);

      if (!allAlbums) return [];

      const filtered = allAlbums.filter(
        (album) => album.artistName?.toLowerCase() === artist.artistName.toLowerCase()
      );
      console.log("[lidarr] getAlbumsByArtistForeignId - fallback filtered:", filtered.length, "albums");
      return filtered;
    }

    return albums;
  }

  async getAllAlbums(): Promise<LidarrAlbum[]> {
    const result = await this.tryRequest<LidarrAlbum[]>("/api/v1/album");
    return result ?? [];
  }

  async getExistingArtistAlbums(foreignArtistId: string): Promise<LidarrArtistAlbum[]> {
    const existingArtist = await this.getExistingArtistByForeignId(foreignArtistId);
    if (!existingArtist) return [];

    const allAlbums = await this.request<LidarrArtistAlbum[]>("/api/v1/album");
    return allAlbums.filter((album) => album.foreignArtistId === foreignArtistId);
  }

  async addArtist(input: AddArtistInput): Promise<LidarrArtist> {
    return this.request<LidarrArtist>("/api/v1/artist", {
      method: "POST",
      body: JSON.stringify({
        artistName: input.artistName,
        foreignArtistId: input.foreignArtistId,
        qualityProfileId: input.qualityProfileId,
        metadataProfileId: input.metadataProfileId,
        rootFolderPath: input.rootFolderPath,
        monitored: true,
        addOptions: {
          monitor: input.monitorMode,
          searchForMissingAlbums: true
        }
      })
    });
  }

  async addAlbum(input: AddAlbumInput): Promise<LidarrAlbum> {
    return this.request<LidarrAlbum>("/api/v1/album", {
      method: "POST",
      body: JSON.stringify({
        title: input.albumTitle,
        foreignAlbumId: input.foreignAlbumId,
        artist: {
          artistName: input.artistName,
          foreignArtistId: input.foreignArtistId
        },
        monitored: true
      })
    });
  }
}
