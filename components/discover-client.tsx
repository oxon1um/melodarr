"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { IconAlbum, IconDownload, IconSearch } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast-provider";

type Artist = {
  artistName: string;
  foreignArtistId?: string;
  mbid?: string;
  overview?: string;
  images?: Array<{ coverType?: string; remoteUrl?: string; url?: string }>;
};

type Album = {
  title: string;
  artistName: string;
  foreignAlbumId?: string;
  foreignArtistId?: string;
  overview?: string;
  images?: Array<{ coverType?: string; remoteUrl?: string; url?: string }>;
  isExisting?: boolean;
};

type Song = {
  title: string;
  artistName: string;
  albumTitle?: string;
  foreignAlbumId?: string;
  foreignSongId?: string;
  foreignArtistId?: string;
  duration?: number;
  images?: Array<{ coverType?: string; remoteUrl?: string; url?: string }>;
};

type DiscoveryResults = {
  artists: Artist[];
  albums: Album[];
  songs: Song[];
};

type FilterType = "all" | "artists" | "albums" | "songs";

type Suggestion = {
  id: string;
  type: "artist" | "album" | "song";
  label: string;
  subLabel?: string;
  artistName: string;
  albumTitle?: string;
  foreignArtistId?: string;
  foreignAlbumId?: string;
};

const emptyResults: DiscoveryResults = {
  artists: [],
  albums: [],
  songs: []
};

const chooseImage = (images?: Array<{ coverType?: string; remoteUrl?: string; url?: string }>) => {
  if (!images || images.length === 0) return undefined;

  return (
    images.find((item) => item.coverType === "poster")?.remoteUrl ??
    images.find((item) => item.coverType === "fanart")?.remoteUrl ??
    images[0]?.remoteUrl ??
    images[0]?.url
  );
};

const albumKey = (album: { foreignAlbumId?: string; artistName: string; title: string }) =>
  album.foreignAlbumId ?? `${album.artistName}:${album.title}`;

const artistKey = (artist: { foreignArtistId?: string; artistName: string }) =>
  artist.foreignArtistId ?? artist.artistName;

const sectionTitle = (value: FilterType) => {
  if (value === "artists") return "Artists";
  if (value === "albums") return "Albums";
  if (value === "songs") return "Tracks";
  return "All Results";
};

export function DiscoverClient() {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DiscoveryResults>(emptyResults);
  const [filter, setFilter] = useState<FilterType>("all");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);

  const requestSequence = useRef(0);

  const fetchDiscovery = async (term: string, showLoader = true) => {
    if (!term.trim() || term.trim().length < 2) {
      setResults(emptyResults);
      return;
    }

    if (showLoader) {
      setLoading(true);
    }

    const currentSeq = ++requestSequence.current;

    const response = await fetch(`/api/search/artists?q=${encodeURIComponent(term)}`);
    const payload = (await response.json()) as DiscoveryResults & { error?: string };

    if (currentSeq !== requestSequence.current) {
      return;
    }

    if (!response.ok) {
      toast.error(payload.error ?? "Search failed", "Discover");
      if (showLoader) setLoading(false);
      return;
    }

    setResults({
      artists: payload.artists ?? [],
      albums: payload.albums ?? [],
      songs: payload.songs ?? []
    });

    if (showLoader) setLoading(false);
  };

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(emptyResults);
      return;
    }

    const timer = window.setTimeout(() => {
      void fetchDiscovery(query, false);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [query]);

  const runSearch = async (event?: FormEvent) => {
    event?.preventDefault();
    setShowSuggestions(false);
    await fetchDiscovery(query, true);
  };

  const requestAlbum = async (
    input: {
      artistName: string;
      albumTitle: string;
      foreignArtistId?: string;
      foreignAlbumId?: string;
    },
    key: string
  ) => {
    setSubmitting(key);

    const response = await fetch("/api/requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        requestType: "album",
        artistName: input.artistName,
        albumTitle: input.albumTitle,
        foreignArtistId: input.foreignArtistId,
        foreignAlbumId: input.foreignAlbumId
      })
    });

    const payload = (await response.json()) as {
      error?: string;
      duplicate?: boolean;
      request?: { status?: string };
    };

    if (!response.ok) {
      toast.error(payload.error ?? "Request failed", "Requests");
      setSubmitting(null);
      return;
    }

    if (payload.duplicate) {
      toast.info("This album has already been requested.", "Requests");
    } else {
      toast.success(`Request saved with status: ${payload.request?.status ?? "unknown"}`, "Requests");
    }

    setSubmitting(null);
  };

  const albumsByArtist = useMemo(() => {
    const map = new Map<string, Album[]>();

    for (const album of results.albums) {
      const key = album.foreignArtistId ?? album.artistName.toLowerCase();
      const current = map.get(key) ?? [];
      current.push(album);
      map.set(key, current);
    }

    return map;
  }, [results.albums]);

  const counts = useMemo(
    () => ({
      artists: results.artists.length,
      albums: results.albums.length,
      songs: results.songs.length
    }),
    [results]
  );

  const totalCount = counts.artists + counts.albums + counts.songs;

  const filters: Array<{ id: FilterType; label: string }> = [
    { id: "all", label: `All (${totalCount})` },
    { id: "artists", label: `Artists (${counts.artists})` },
    { id: "albums", label: `Albums (${counts.albums})` },
    { id: "songs", label: `Tracks (${counts.songs})` }
  ];

  const suggestions = useMemo(() => {
    const artistSuggestions: Suggestion[] = results.artists.slice(0, 4).map((artist) => ({
      id: `artist:${artistKey(artist)}`,
      type: "artist",
      label: artist.artistName,
      subLabel: "Artist",
      artistName: artist.artistName,
      foreignArtistId: artist.foreignArtistId
    }));

    const albumSuggestions: Suggestion[] = results.albums.slice(0, 4).map((album) => ({
      id: `album:${albumKey({
        foreignAlbumId: album.foreignAlbumId,
        artistName: album.artistName,
        title: album.title
      })}`,
      type: "album",
      label: album.title,
      subLabel: `Album - ${album.artistName}`,
      artistName: album.artistName,
      albumTitle: album.title,
      foreignArtistId: album.foreignArtistId,
      foreignAlbumId: album.foreignAlbumId
    }));

    const songSuggestions: Suggestion[] = results.songs.slice(0, 4).map((song) => ({
      id: `song:${song.foreignSongId ?? `${song.artistName}:${song.title}`}`,
      type: "song",
      label: song.title,
      subLabel: `Track - ${song.artistName}${song.albumTitle ? ` - ${song.albumTitle}` : ""}`,
      artistName: song.artistName,
      albumTitle: song.albumTitle,
      foreignArtistId: song.foreignArtistId,
      foreignAlbumId: song.foreignAlbumId
    }));

    return [...artistSuggestions, ...albumSuggestions, ...songSuggestions].slice(0, 10);
  }, [results]);

  useEffect(() => {
    if (activeSuggestionIndex >= suggestions.length) {
      setActiveSuggestionIndex(0);
    }
  }, [activeSuggestionIndex, suggestions.length]);

  const chooseSuggestion = (suggestion: Suggestion) => {
    setQuery(suggestion.type === "album" || suggestion.type === "song" ? suggestion.label : suggestion.artistName);
    setShowSuggestions(false);

    if (suggestion.type === "artist") setFilter("artists");
    if (suggestion.type === "album") setFilter("albums");
    if (suggestion.type === "song") setFilter("songs");
  };

  return (
    <div className="page-enter space-y-7">
      <section className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Discover Music</h1>
        <p className="text-sm text-muted">Search artists, albums, and tracks.</p>
      </section>

      <form onSubmit={runSearch} className="panel relative flex flex-col gap-3 p-4 sm:p-5 md:flex-row">
        <div className="relative min-w-0 flex-1">
          <div className="pointer-events-none absolute left-[3.5rem] top-1/2 -translate-y-1/2 text-muted/50">
            <IconSearch className="h-5 w-5" />
          </div>
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setShowSuggestions(true);
              setActiveSuggestionIndex(0);
            }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={(event) => {
              if (!showSuggestions || suggestions.length === 0) return;

              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveSuggestionIndex((prev) => (prev + 1) % suggestions.length);
              }

              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveSuggestionIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
              }

              if (event.key === "Enter" && suggestions[activeSuggestionIndex]) {
                event.preventDefault();
                chooseSuggestion(suggestions[activeSuggestionIndex]);
              }

              if (event.key === "Escape") {
                setShowSuggestions(false);
              }
            }}
            placeholder="Search for music..."
            className="field w-full pl-14 pr-4"
          />

          {showSuggestions && suggestions.length > 0 ? (
            <div className="absolute left-0 right-0 top-[3.75rem] z-[10000] rounded-2xl border border-white/[0.1] bg-[#060c1a]/95 p-1 shadow-panel backdrop-blur-xl">
              <ul className="soft-scroll max-h-72 overflow-auto">
                {suggestions.map((suggestion, index) => (
                  <li key={suggestion.id}>
                    <button
                      type="button"
                      className={`flex w-full items-start justify-between rounded-xl px-3 py-2.5 text-left transition ${
                        index === activeSuggestionIndex
                          ? "bg-accent/15 text-accent-glow"
                          : "text-muted hover:bg-white/[0.04] hover:text-white"
                      }`}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        chooseSuggestion(suggestion);
                      }}
                    >
                      <span className="truncate pr-2 font-medium">{suggestion.label}</span>
                      <span className="shrink-0 text-xs opacity-60">{suggestion.subLabel}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <button type="submit" disabled={loading} className="btn-primary min-w-[9rem] py-3">
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Searching...
            </span>
          ) : (
            <>
              <IconSearch className="h-4 w-4" />
              Search
            </>
          )}
        </button>
      </form>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip">{sectionTitle(filter)}</span>
          <span className="chip">{totalCount} results</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={filter === item.id ? "btn-ghost-active rounded-lg" : "btn-ghost rounded-lg"}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {(filter === "all" || filter === "artists") && results.artists.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Artists</h2>
          <div className="space-y-5">
            {results.artists.map((artist, artistIndex) => {
              const key = artistKey(artist);
              const image = chooseImage(artist.images);
              const artistAlbums =
                albumsByArtist.get(artist.foreignArtistId ?? "") ??
                albumsByArtist.get(artist.artistName.toLowerCase()) ??
                [];

              return (
                <Card
                  key={`artist:${key}`}
                  className="space-y-4 motion-safe:animate-fade-in-up"
                  style={{ animationDelay: `${Math.min(artistIndex * 50, 280)}ms` }}
                >
                  <div className="flex gap-4">
                    <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-white/[0.1] bg-panel-2">
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={image} alt={artist.artistName} className="h-full w-full object-cover transition-transform duration-300 hover:scale-105" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-muted">No cover</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      {artist.foreignArtistId ? (
                        <Link
                          href={`/discover/${artist.foreignArtistId}`}
                          className="text-lg font-semibold tracking-tight hover:text-accent-glow"
                        >
                          {artist.artistName}
                        </Link>
                      ) : (
                        <h3 className="text-lg font-semibold tracking-tight">{artist.artistName}</h3>
                      )}
                      <p className="mt-1.5 line-clamp-2 text-sm text-muted">
                        {artist.overview ?? "No description provided by Lidarr metadata."}
                      </p>
                      <p className="mt-2 text-xs text-muted/70">
                        {artistAlbums.length > 0
                          ? `${artistAlbums.length} album${artistAlbums.length === 1 ? "" : "s"} available`
                          : "No album lookup results for this artist"}
                      </p>
                    </div>
                  </div>

                  {artistAlbums.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {artistAlbums.map((album, albumIndex) => {
                        const aKey = albumKey({
                          foreignAlbumId: album.foreignAlbumId,
                          artistName: album.artistName,
                          title: album.title
                        });
                        const cover = chooseImage(album.images);

                        return (
                          <div
                            key={`artist-album:${aKey}`}
                            className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-panel-2/40 p-3 transition-all hover:border-white/[0.15] motion-safe:animate-fade-in-up"
                            style={{ animationDelay: `${Math.min(albumIndex * 40, 200)}ms` }}
                          >
                            <div className="relative overflow-hidden rounded-xl border border-white/[0.1] bg-panel-2">
                              <div className="aspect-square">
                                {cover ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={cover} alt={album.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                                ) : (
                                  <div className="flex h-full items-center justify-center text-xs text-muted">
                                    No cover
                                  </div>
                                )}
                              </div>
                              {album.isExisting && (
                                <div className="absolute left-1 top-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
                                  <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  void requestAlbum(
                                    {
                                      artistName: album.artistName,
                                      albumTitle: album.title,
                                      foreignArtistId: album.foreignArtistId,
                                      foreignAlbumId: album.foreignAlbumId
                                    },
                                    `artist-album:${aKey}`
                                  )
                                }
                                disabled={submitting === `artist-album:${aKey}` || album.isExisting}
                                className="quick-icon"
                                aria-label={`Quick download ${album.title}`}
                                title={album.isExisting ? "Already in library" : "Quick download album"}
                              >
                                {submitting === `artist-album:${aKey}` ? (
                                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                ) : (
                                  <IconDownload className="h-4 w-4" />
                                )}
                                <span className="sr-only">Quick download album</span>
                              </button>
                            </div>
                            <p className="mt-2.5 truncate text-sm font-medium text-text">{album.title}</p>
                            <button
                              type="button"
                              onClick={() =>
                                void requestAlbum(
                                  {
                                    artistName: album.artistName,
                                    albumTitle: album.title,
                                    foreignArtistId: album.foreignArtistId,
                                    foreignAlbumId: album.foreignAlbumId
                                  },
                                  `artist-album:${aKey}`
                                )
                              }
                              disabled={submitting === `artist-album:${aKey}` || album.isExisting}
                              className="btn-primary mt-2.5 w-full py-2 text-sm"
                            >
                              {album.isExisting
                                ? "In Library"
                                : submitting === `artist-album:${aKey}`
                                  ? "Requesting..."
                                  : "Download Album"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </Card>
              );
            })}
          </div>
        </section>
      ) : null}

      {(filter === "all" || filter === "albums") && results.albums.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Albums</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {results.albums.map((album, index) => {
              const key = albumKey({
                foreignAlbumId: album.foreignAlbumId,
                artistName: album.artistName,
                title: album.title
              });
              const image = chooseImage(album.images);

              return (
                <Card
                  key={`album:${key}`}
                  className="group motion-safe:animate-fade-in-up"
                  style={{ animationDelay: `${Math.min(index * 40, 240)}ms` }}
                >
                  <div className="flex gap-4">
                    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-white/[0.1] bg-panel-2">
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={image} alt={album.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-muted">No cover</div>
                      )}
                      {album.isExisting && (
                        <div className="absolute left-1 top-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
                          <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          void requestAlbum(
                            {
                              artistName: album.artistName,
                              albumTitle: album.title,
                              foreignArtistId: album.foreignArtistId,
                              foreignAlbumId: album.foreignAlbumId
                            },
                            `album:${key}`
                          )
                        }
                        disabled={submitting === `album:${key}` || album.isExisting}
                        className="quick-icon"
                        aria-label={`Quick download ${album.title}`}
                        title={album.isExisting ? "Already in library" : "Quick download album"}
                      >
                        {submitting === `album:${key}` ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <IconDownload className="h-4 w-4" />
                        )}
                        <span className="sr-only">Quick download album</span>
                      </button>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-semibold tracking-tight">{album.title}</h3>
                      <p className="text-sm text-muted">{album.artistName}</p>
                      <p className="mt-1.5 line-clamp-2 text-xs text-muted/80">
                        {album.overview ?? "No album overview available."}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          void requestAlbum(
                            {
                              artistName: album.artistName,
                              albumTitle: album.title,
                              foreignArtistId: album.foreignArtistId,
                              foreignAlbumId: album.foreignAlbumId
                            },
                            `album:${key}`
                          )
                        }
                        disabled={submitting === `album:${key}` || album.isExisting}
                        className="btn-primary mt-3 py-2 text-sm"
                      >
                        {album.isExisting
                          ? "In Library"
                          : submitting === `album:${key}`
                            ? "Requesting..."
                            : "Download Album"}
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      ) : null}

      {(filter === "all" || filter === "songs") && results.songs.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Tracks</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {results.songs.map((song, index) => {
              const key = `song:${song.foreignSongId ?? `${song.artistName}:${song.title}`}`;
              const image = chooseImage(song.images);
              const canRequest = Boolean(song.albumTitle);

              return (
                <Card
                  key={key}
                  className="group motion-safe:animate-fade-in-up"
                  style={{ animationDelay: `${Math.min(index * 40, 240)}ms` }}
                >
                  <div className="flex gap-4">
                    <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-white/[0.1] bg-panel-2">
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={image} alt={song.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-muted">No cover</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-semibold tracking-tight">{song.title}</h3>
                      <p className="text-sm text-muted">{song.artistName}</p>
                      <p className="text-xs text-muted/70">Album: {song.albumTitle ?? "Unknown album mapping"}</p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setFilter("albums");
                            if (song.albumTitle) {
                              setQuery(song.albumTitle);
                            }
                          }}
                          className="btn-ghost rounded-lg text-xs"
                        >
                          <span className="inline-flex items-center gap-2">
                            <IconAlbum className="h-3.5 w-3.5" />
                            View Album
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            canRequest
                              ? void requestAlbum(
                                  {
                                    artistName: song.artistName,
                                    albumTitle: song.albumTitle ?? "",
                                    foreignArtistId: song.foreignArtistId,
                                    foreignAlbumId: song.foreignAlbumId
                                  },
                                  key
                                )
                              : undefined
                          }
                          disabled={submitting === key || !canRequest}
                          className="btn-primary rounded-lg py-2 text-xs disabled:cursor-not-allowed"
                        >
                          {submitting === key ? "Requesting..." : "Download Album"}
                        </button>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      ) : null}

      {totalCount === 0 && query.trim().length > 0 && !loading ? (
        <div className="empty-state">
          <div className="mb-4 flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-panel-2/50">
            <svg className="h-8 w-8 text-muted/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <p className="text-muted">No results found for "{query}"</p>
          <p className="mt-1 text-xs text-muted/70">Try a different search term</p>
        </div>
      ) : null}
    </div>
  );
}
