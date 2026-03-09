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
  artist?: {
    artistName?: string;
    foreignArtistId?: string;
  };
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
    private readonly apiKey: string,
    private readonly debug: boolean = false
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
    // Always try search endpoint first for fresh metadata (includes images)
    // The existing artist may have empty images but search returns full metadata
    const encoded = encodeURIComponent(foreignArtistId);
    const searchResults = await this.tryRequest<LidarrArtist[]>(`/api/v1/artist/lookup?term=${encoded}`);
    if (this.debug) console.log("[lidarr] getArtistByForeignId - search results:", searchResults?.length ?? 0, "artists");

    // Get existing artist from library for fallback (has overview)
    const existingArtist = await this.getExistingArtistByForeignId(foreignArtistId);
    if (this.debug) console.log("[lidarr] getArtistByForeignId - existing artist:", existingArtist ? { id: existingArtist.id, name: existingArtist.artistName, hasOverview: !!existingArtist.overview } : null);

    // Filter results to find matching artist by foreignArtistId
    if (searchResults && searchResults.length > 0) {
      const match = searchResults.find((a) => a.foreignArtistId === foreignArtistId);
      if (this.debug) console.log("[lidarr] getArtistByForeignId - matched artist:", match ? { name: match.artistName, imagesCount: match.images?.length, hasOverview: !!match.overview } : null);
      if (match) {
        // If search result has no overview but existing artist does, merge them
        if ((!match.overview || match.overview.trim() === "") && existingArtist?.overview) {
          if (this.debug) console.log("[lidarr] getArtistByForeignId - using existing artist overview");
          return { ...match, overview: existingArtist.overview };
        }
        return match;
      }

      // No exact match found - log warning and prefer existing artist with overview
      if (searchResults.length > 0) {
        if (this.debug) console.log("[lidarr] getArtistByForeignId - no exact match, first result:", searchResults[0].artistName);
        if (existingArtist?.overview) {
          // Use first search result for images but existing artist for overview
          if (this.debug) console.log("[lidarr] getArtistByForeignId - using search result with existing overview");
          return { ...searchResults[0], overview: existingArtist.overview };
        }
        return searchResults[0];
      }
    }

    // Fallback: return existing artist from library
    if (this.debug) console.log("[lidarr] getArtistByForeignId - using existing artist fallback");
    return existingArtist;
  }

  async getAlbumsByArtistForeignId(foreignArtistId: string): Promise<LidarrArtistAlbum[]> {
    // First try: search by term
    const encoded = encodeURIComponent(foreignArtistId);
    let albums = await this.tryRequest<LidarrArtistAlbum[]>(`/api/v1/album/lookup?term=${encoded}`);
    if (this.debug) console.log("[lidarr] getAlbumsByArtistForeignId - search results:", albums?.length ?? 0, "albums");

    // Filter to only albums matching the foreignArtistId
    if (albums && albums.length > 0) {
      const matching = albums.filter((a) => a.foreignArtistId === foreignArtistId);
      if (this.debug) console.log("[lidarr] getAlbumsByArtistForeignId - filtered by foreignArtistId:", matching.length, "albums");
      if (matching.length > 0) return matching;
    }

    if (!albums || albums.length === 0) {
      if (this.debug) console.log("[lidarr] getAlbumsByArtistForeignId - no albums from search, trying fallback");
      // Fallback: search by artist name in existing albums
      const artist = await this.getArtistByForeignId(foreignArtistId);
      if (!artist) {
        if (this.debug) console.log("[lidarr] getAlbumsByArtistForeignId - no artist found for fallback");
        return [];
      }

      if (this.debug) console.log("[lidarr] getAlbumsByArtistForeignId - fallback artist:", artist.artistName);
      const allAlbums = await this.tryRequest<LidarrArtistAlbum[]>("/api/v1/album");
      if (this.debug) console.log("[lidarr] getAlbumsByArtistForeignId - all albums in library:", allAlbums?.length ?? 0);

      if (!allAlbums) return [];

      const filtered = allAlbums.filter(
        (album) => album.artistName?.toLowerCase() === artist.artistName.toLowerCase() ||
                  album.artist?.artistName?.toLowerCase() === artist.artistName.toLowerCase()
      );
      if (this.debug) console.log("[lidarr] getAlbumsByArtistForeignId - fallback filtered:", filtered.length, "albums");
      return filtered;
    }

    return albums;
  }

  async getAlbumByForeignId(foreignAlbumId: string): Promise<LidarrArtistAlbum | null> {
    // Try search endpoint first for fresh metadata
    const encoded = encodeURIComponent(foreignAlbumId);
    const searchResults = await this.tryRequest<LidarrArtistAlbum[]>(`/api/v1/album/lookup?term=${encoded}`);
    if (this.debug) console.log("[lidarr] getAlbumByForeignId - search results:", searchResults?.length ?? 0, "albums");

    if (searchResults && searchResults.length > 0) {
      const match = searchResults.find((a) => a.foreignAlbumId === foreignAlbumId);
      if (this.debug) console.log("[lidarr] getAlbumByForeignId - matched album:", match ? { title: match.title, imagesCount: match.images?.length } : null);
      if (match) return match;
      return searchResults[0];
    }

    // Fallback: check existing albums
    const existingAlbum = await this.getExistingAlbumByForeignId(foreignAlbumId);
    if (this.debug) console.log("[lidarr] getAlbumByForeignId - existing album fallback:", existingAlbum ? { id: existingAlbum.id, title: existingAlbum.title } : null);
    return existingAlbum;
  }

  async getAlbumTracks(foreignAlbumId: string): Promise<LidarrSongSearchResult[]> {
    // First check if album is in the library - use trackfile endpoint
    const existingAlbum = await this.getExistingAlbumByForeignId(foreignAlbumId);
    if (this.debug) console.log("[lidarr] getAlbumTracks - existing album:", existingAlbum ? { id: existingAlbum.id, title: existingAlbum.title } : null);

    if (existingAlbum) {
      // Album is in library - get tracks from trackfiles
      const trackfiles = await this.tryRequest<unknown[]>(`/api/v1/trackfile?albumId=${existingAlbum.id}`);
      if (this.debug) console.log("[lidarr] getAlbumTracks - trackfiles:", trackfiles?.length ?? 0);

      if (trackfiles && trackfiles.length > 0) {
        const tracks = trackfiles
          .map((tf) => {
            const item = asRecord(tf);
            if (!item) return null;
            return normalizeSong({
              title: pickString(item, "title"),
              artistName: pickString(item, "artistName"),
              albumTitle: pickString(item, "albumTitle"),
              foreignAlbumId: pickString(item, "foreignAlbumId"),
              foreignSongId: pickString(item, "foreignSongId"),
              foreignArtistId: pickString(item, "foreignArtistId"),
              duration: pickNumber(item, "duration", "durationMs"),
              trackNumber: pickNumber(item, "trackNumber")
            });
          })
          .filter((t): t is LidarrSongSearchResult => t !== null);

        if (tracks.length > 0) {
          if (this.debug) console.log("[lidarr] getAlbumTracks - found tracks from trackfiles:", tracks.length);
          return tracks;
        }
      }
    }

    // Fallback: try song/lookup endpoint with album ID term
    const encoded = encodeURIComponent(foreignAlbumId);
    const songs = await this.tryRequest<LidarrSongSearchResult[]>(`/api/v1/song/lookup?term=${encoded}`);
    if (this.debug) console.log("[lidarr] getAlbumTracks - song lookup results:", songs?.length ?? 0);

    if (songs && songs.length > 0) {
      // Filter to tracks that match this album
      const matchingTracks = songs.filter((s) => s.foreignAlbumId === foreignAlbumId);
      if (matchingTracks.length > 0) {
        if (this.debug) console.log("[lidarr] getAlbumTracks - filtered tracks:", matchingTracks.length);
        return matchingTracks;
      }
      // If no exact match, return all found tracks (might be from different release)
      if (this.debug) console.log("[lidarr] getAlbumTracks - no exact match, returning all:", songs.length);
      return songs;
    }

    // Last fallback: try album lookup endpoint
    const albumData = await this.tryRequest<{ songs?: LidarrSongSearchResult[] }>(`/api/v1/album/lookup?term=${encoded}`);
    if (this.debug) console.log("[lidarr] getAlbumTracks - album lookup:", albumData ? { songCount: albumData.songs?.length ?? 0 } : null);

    if (albumData?.songs && albumData.songs.length > 0) {
      return albumData.songs;
    }

    return [];
  }

  async getAllAlbums(): Promise<LidarrAlbum[]> {
    const result = await this.tryRequest<LidarrAlbum[]>("/api/v1/album");
    return result ?? [];
  }

  async getExistingArtistAlbums(foreignArtistId: string): Promise<LidarrArtistAlbum[]> {
    // Check all albums in library regardless of whether artist was added
    const allAlbums = await this.request<LidarrArtistAlbum[]>("/api/v1/album");
    if (this.debug) console.log("[lidarr] getExistingArtistAlbums - all albums in library:", allAlbums?.length ?? 0, "checking for foreignArtistId:", foreignArtistId);

    const filtered = allAlbums.filter((album) => album.foreignArtistId === foreignArtistId);
    if (this.debug) console.log("[lidarr] getExistingArtistAlbums - matched albums:", filtered.length);

    return filtered;
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
