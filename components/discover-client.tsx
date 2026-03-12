"use client";

import type { Route } from "next";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { CoverImage } from "@/components/ui/cover-image";
import { IconDownload } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast-provider";
import {
  filterNoisySingles,
  RELEASE_SORT_OPTIONS,
  type ReleaseSort,
  sortReleases
} from "@/lib/discover/release-browser";
import type { ImageAsset } from "@/lib/images";
import { useProgressiveCount } from "@/lib/use-progressive-count";

type Artist = {
  artistName: string;
  foreignArtistId?: string;
  mbid?: string;
  overview?: string;
  images?: ImageAsset[];
};

type Album = {
  title: string;
  artistName: string;
  foreignAlbumId?: string;
  foreignArtistId?: string;
  releaseGroup?: "album" | "single";
  releaseDate?: string;
  secondaryTypes?: string[];
  releaseStatuses?: string[];
  overview?: string;
  images?: ImageAsset[];
  isTracked?: boolean;
  hasFiles?: boolean;
};

type DiscoveryResults = {
  artists: Artist[];
  albums: Album[];
  singles: Album[];
};

type FilterType = "all" | "artists" | "albums" | "singles";

type Suggestion = {
  id: string;
  type: "artist" | "album" | "single";
  label: string;
  subLabel?: string;
  artistName: string;
  albumTitle?: string;
  foreignArtistId?: string;
  foreignAlbumId?: string;
};

type ArtistRouteInput = {
  artistName: string;
  foreignArtistId?: string;
  from?: string;
};

type AlbumRouteInput = {
  artistName: string;
  foreignArtistId?: string;
  foreignAlbumId?: string;
  from?: string;
};

type SavedSearch = {
  query: string;
  filter: FilterType;
  sort: ReleaseSort;
  hideNoisySingles: boolean;
};

const emptyResults: DiscoveryResults = {
  artists: [],
  albums: [],
  singles: []
};

const RECENT_SEARCHES_KEY = "melodarr:discover-recent-searches";
const DEFAULT_RELEASE_SORT: ReleaseSort = "newest";

const pickImage = (
  images: ImageAsset[] | undefined,
  preferredTypes: string[]
) => {
  if (!images || images.length === 0) return undefined;

  return (
    preferredTypes.map((type) => images.find((item) => item.coverType === type)?.optimizedUrl).find(Boolean) ??
    preferredTypes.map((type) => images.find((item) => item.coverType === type)?.remoteUrl).find(Boolean) ??
    preferredTypes.map((type) => images.find((item) => item.coverType === type)?.url).find(Boolean) ??
    images[0]?.optimizedUrl ??
    images[0]?.remoteUrl ??
    images[0]?.url
  );
};

const chooseArtistImage = (images?: ImageAsset[]) =>
  pickImage(images, ["poster", "cover", "fanart", "banner"]);

const chooseAlbumImage = (images?: ImageAsset[]) =>
  pickImage(images, ["cover", "poster", "fanart", "banner"]);

const albumKey = (album: { foreignAlbumId?: string; artistName: string; title: string }) =>
  album.foreignAlbumId ?? `${album.artistName}:${album.title}`;

const artistKey = (artist: { foreignArtistId?: string; artistName: string }) =>
  artist.foreignArtistId ?? artist.artistName;

export const buildArtistHref = ({ artistName, foreignArtistId, from }: ArtistRouteInput): Route | undefined =>
  foreignArtistId
    ? (`/discover/${encodeURIComponent(foreignArtistId)}?artistName=${encodeURIComponent(artistName)}${from ? `&from=${encodeURIComponent(from)}` : ""}` as Route)
    : undefined;

export const buildAlbumHref = ({ artistName, foreignArtistId, foreignAlbumId, from }: AlbumRouteInput): Route | undefined =>
  foreignArtistId && foreignAlbumId
    ? (`/discover/${encodeURIComponent(foreignArtistId)}/${encodeURIComponent(foreignAlbumId)}?artistName=${encodeURIComponent(artistName)}${from ? `&from=${encodeURIComponent(from)}` : ""}` as Route)
    : undefined;

const sectionTitle = (value: FilterType) => {
  if (value === "artists") return "Artists";
  if (value === "albums") return "Albums";
  if (value === "singles") return "Singles";
  return "All Results";
};

const albumActionLabel = (album: Pick<Album, "isTracked" | "hasFiles">) => {
  if (album.hasFiles) return "Available";
  if (album.isTracked) return "Tracked in Lidarr";
  return "Download Album";
};

const albumActionTitle = (album: Pick<Album, "isTracked" | "hasFiles">) => {
  if (album.hasFiles) return "Already available";
  if (album.isTracked) return "Already tracked in Lidarr";
  return "Quick download album";
};

export function DiscoverClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [results, setResults] = useState<DiscoveryResults>(emptyResults);
  const [filter, setFilter] = useState<FilterType>(() => {
    const value = searchParams.get("filter");
    return value === "artists" || value === "albums" || value === "singles"
      ? value
      : "all";
  });
  const [sort, setSort] = useState<ReleaseSort>(() => {
    const value = searchParams.get("sort");
    return RELEASE_SORT_OPTIONS.some((option) => option.value === value)
      ? (value as ReleaseSort)
      : DEFAULT_RELEASE_SORT;
  });
  const [hideNoisySingles, setHideNoisySingles] = useState(searchParams.get("hideNoisySingles") === "1");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isSuggestionsHovered, setIsSuggestionsHovered] = useState(false);
  const [recentSearches, setRecentSearches] = useState<SavedSearch[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    const saved = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!saved) {
      return [];
    }

    try {
      const parsed = JSON.parse(saved) as SavedSearch[];
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.filter((entry): entry is SavedSearch =>
        Boolean(
          entry
          && typeof entry.query === "string"
          && typeof entry.filter === "string"
          && typeof entry.sort === "string"
          && typeof entry.hideNoisySingles === "boolean"
        )
      );
    } catch {
      window.localStorage.removeItem(RECENT_SEARCHES_KEY);
      return [];
    }
  });

  const requestSequence = useRef(0);
  const searchRegionRef = useRef<HTMLFormElement | null>(null);

  const discoverStateHref = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim().length >= 2) {
      params.set("q", query.trim());
    }
    if (filter !== "all") {
      params.set("filter", filter);
    }
    if (sort !== DEFAULT_RELEASE_SORT) {
      params.set("sort", sort);
    }
    if (hideNoisySingles) {
      params.set("hideNoisySingles", "1");
    }

    const search = params.toString();
    return search ? `${pathname}?${search}` : pathname;
  }, [filter, hideNoisySingles, pathname, query, sort]);

  const buildDiscoverStateHref = useCallback((
    nextQuery: string,
    nextFilter: FilterType,
    nextSort: ReleaseSort,
    nextHideNoisySingles: boolean
  ) => {
    const params = new URLSearchParams();
    if (nextQuery.trim().length >= 2) {
      params.set("q", nextQuery.trim());
    }
    if (nextFilter !== "all") {
      params.set("filter", nextFilter);
    }
    if (nextSort !== DEFAULT_RELEASE_SORT) {
      params.set("sort", nextSort);
    }
    if (nextHideNoisySingles) {
      params.set("hideNoisySingles", "1");
    }

    const search = params.toString();
    return search ? `${pathname}?${search}` : pathname;
  }, [pathname]);

  const fetchDiscovery = useCallback(async (
    term: string,
    showLoader = true,
    stateOverride?: {
      filter?: FilterType;
      sort?: ReleaseSort;
      hideNoisySingles?: boolean;
    }
  ) => {
    const nextFilter = stateOverride?.filter ?? filter;
    const nextSort = stateOverride?.sort ?? sort;
    const nextHideNoisySingles = stateOverride?.hideNoisySingles ?? hideNoisySingles;

    if (!term.trim() || term.trim().length < 2) {
      setResults(emptyResults);
      const params = new URLSearchParams(searchParams.toString());
      params.delete("q");
      if (nextFilter === "all") {
        params.delete("filter");
      } else {
        params.set("filter", nextFilter);
      }
      if (nextSort === DEFAULT_RELEASE_SORT) {
        params.delete("sort");
      } else {
        params.set("sort", nextSort);
      }
      if (nextHideNoisySingles) {
        params.set("hideNoisySingles", "1");
      } else {
        params.delete("hideNoisySingles");
      }
      window.history.replaceState(null, "", params.toString() ? `${pathname}?${params.toString()}` : pathname);
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
      singles: payload.singles ?? []
    });

    const trimmedTerm = term.trim();
    const nextRecent = [
      { query: trimmedTerm, filter: nextFilter, sort: nextSort, hideNoisySingles: nextHideNoisySingles },
      ...recentSearches.filter((entry) => entry.query !== trimmedTerm)
    ].slice(0, 8);
    setRecentSearches(nextRecent);
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(nextRecent));
    window.history.replaceState(null, "", buildDiscoverStateHref(term, nextFilter, nextSort, nextHideNoisySingles));

    if (showLoader) setLoading(false);
  }, [buildDiscoverStateHref, filter, hideNoisySingles, pathname, recentSearches, searchParams, sort, toast]);

  useEffect(() => {
    if (query.trim().length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults(emptyResults);
      return;
    }

    const timer = window.setTimeout(() => {
      void fetchDiscovery(query, false);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [query, fetchDiscovery]);

  useEffect(() => {
    window.history.replaceState(null, "", discoverStateHref);
  }, [discoverStateHref]);

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

  const releasesByArtist = useMemo(() => {
    const map = new Map<string, Album[]>();

    for (const album of [...sortReleases(results.albums, sort), ...filterNoisySingles(sortReleases(results.singles, sort), hideNoisySingles)]) {
      const key = album.foreignArtistId ?? album.artistName.toLowerCase();
      const current = map.get(key) ?? [];
      current.push(album);
      map.set(key, current);
    }

    return map;
  }, [hideNoisySingles, results.albums, results.singles, sort]);

  const displayedAlbums = useMemo(() => sortReleases(results.albums, sort), [results.albums, sort]);
  const displayedSingles = useMemo(
    () => filterNoisySingles(sortReleases(results.singles, sort), hideNoisySingles),
    [hideNoisySingles, results.singles, sort]
  );

  const counts = useMemo(
    () => ({
      artists: results.artists.length,
      albums: displayedAlbums.length,
      singles: displayedSingles.length
    }),
    [displayedAlbums.length, displayedSingles.length, results.artists.length]
  );

  const totalCount = counts.artists + counts.albums + counts.singles;
  const {
    visibleCount: visibleAlbumCount,
    sentinelRef: albumSentinelRef,
    hasMore: hasMoreAlbums
  } = useProgressiveCount(displayedAlbums.length, [query, filter, sort, hideNoisySingles, displayedAlbums.length]);
  const {
    visibleCount: visibleSingleCount,
    sentinelRef: singleSentinelRef,
    hasMore: hasMoreSingles
  } = useProgressiveCount(displayedSingles.length, [query, filter, sort, hideNoisySingles, displayedSingles.length]);
  const visibleAlbums = useMemo(
    () => displayedAlbums.slice(0, visibleAlbumCount),
    [displayedAlbums, visibleAlbumCount]
  );
  const visibleSingles = useMemo(
    () => displayedSingles.slice(0, visibleSingleCount),
    [displayedSingles, visibleSingleCount]
  );

  const filters: Array<{ id: FilterType; label: string }> = [
    { id: "all", label: `All (${totalCount})` },
    { id: "artists", label: `Artists (${counts.artists})` },
    { id: "albums", label: `Albums (${counts.albums})` },
    { id: "singles", label: `Singles (${counts.singles})` }
  ];

  const suggestions = useMemo(() => {
    const artistSuggestions: Suggestion[] = results.artists.map((artist) => ({
      id: `artist:${artistKey(artist)}`,
      type: "artist",
      label: artist.artistName,
      subLabel: "Artist",
      artistName: artist.artistName,
      foreignArtistId: artist.foreignArtistId
    }));

    const albumSuggestions: Suggestion[] = displayedAlbums.map((album) => ({
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

    const singleSuggestions: Suggestion[] = displayedSingles.map((single) => ({
      id: `single:${albumKey({
        foreignAlbumId: single.foreignAlbumId,
        artistName: single.artistName,
        title: single.title
      })}`,
      type: "single",
      label: single.title,
      subLabel: `Single - ${single.artistName}`,
      artistName: single.artistName,
      albumTitle: single.title,
      foreignArtistId: single.foreignArtistId,
      foreignAlbumId: single.foreignAlbumId
    }));

    return [...artistSuggestions, ...albumSuggestions, ...singleSuggestions].slice(0, 10);
  }, [displayedAlbums, displayedSingles, results.artists]);

  useEffect(() => {
    if (!showSuggestions || suggestions.length === 0 || isSuggestionsHovered) {
      return;
    }

    const timer = window.setTimeout(() => {
      setShowSuggestions(false);
    }, isSearchFocused ? 2000 : 800);

    return () => window.clearTimeout(timer);
  }, [isSearchFocused, isSuggestionsHovered, showSuggestions, suggestions.length, query]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target || searchRegionRef.current?.contains(target)) {
        return;
      }

      setShowSuggestions(false);
      setIsSearchFocused(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const chooseSuggestion = (suggestion: Suggestion) => {
    setShowSuggestions(false);

    const artistHref = buildArtistHref({
      artistName: suggestion.artistName,
      foreignArtistId: suggestion.foreignArtistId,
      from: discoverStateHref
    });
    const albumHref = buildAlbumHref({
      artistName: suggestion.artistName,
      foreignArtistId: suggestion.foreignArtistId,
      foreignAlbumId: suggestion.foreignAlbumId,
      from: discoverStateHref
    });

    if (suggestion.type === "artist" && artistHref) {
      router.push(artistHref);
      return;
    }

    if ((suggestion.type === "album" || suggestion.type === "single") && albumHref) {
      router.push(albumHref);
      return;
    }

    setQuery(suggestion.type === "album" || suggestion.type === "single" ? suggestion.label : suggestion.artistName);

    if (suggestion.type === "artist") setFilter("artists");
    if (suggestion.type === "album") setFilter("albums");
    if (suggestion.type === "single") setFilter("singles");
  };

  return (
    <div className="page-enter space-y-7">
      <section className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Discover Music</h1>
        <p className="text-sm text-muted">Search artists, albums, and singles.</p>
      </section>

      <form
        ref={searchRegionRef}
        onSubmit={runSearch}
        className="panel relative z-30 flex flex-col gap-3 p-4 sm:p-5 md:flex-row"
        onMouseLeave={() => {
          setIsSuggestionsHovered(false);
          if (!isSearchFocused) {
            setShowSuggestions(false);
          }
        }}
      >
        <div className="relative min-w-0 flex-1">
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setShowSuggestions(true);
              setActiveSuggestionIndex(0);
            }}
            onFocus={() => {
              setIsSearchFocused(true);
              setShowSuggestions(true);
            }}
            onBlur={(event) => {
              const nextTarget = event.relatedTarget as Node | null;
              if (nextTarget && searchRegionRef.current?.contains(nextTarget)) {
                return;
              }

              setIsSearchFocused(false);
              if (!searchRegionRef.current?.matches(":hover")) {
                setShowSuggestions(false);
              }
            }}
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

              if (event.key === "Enter" && suggestions.length > 0) {
                event.preventDefault();
                chooseSuggestion(suggestions[activeSuggestionIndex] ?? suggestions[0]);
              }

              if (event.key === "Escape") {
                setShowSuggestions(false);
              }
            }}
            placeholder="Search for music..."
            className="field w-full pl-4 pr-4"
          />

          {showSuggestions && suggestions.length > 0 ? (
            <div
              className="absolute left-0 right-0 top-[3.75rem] z-[10001] rounded-2xl border border-white/[0.1] bg-[#060c1a]/95 p-1 shadow-panel backdrop-blur-xl"
              onMouseEnter={() => setIsSuggestionsHovered(true)}
              onMouseLeave={() => {
                setIsSuggestionsHovered(false);
                if (!isSearchFocused) {
                  setShowSuggestions(false);
                }
              }}
            >
              <ul className="soft-scroll max-h-[30rem] overflow-auto">
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
            "Search"
          )}
        </button>
      </form>

      {recentSearches.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="chip">Recently searched</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((entry) => (
              <button
                key={`${entry.query}:${entry.filter}:${entry.sort}:${entry.hideNoisySingles ? "hide" : "show"}`}
                type="button"
                onClick={() => {
                  setQuery(entry.query);
                  setFilter(entry.filter);
                  setSort(entry.sort);
                  setHideNoisySingles(entry.hideNoisySingles);
                  void fetchDiscovery(entry.query, true, {
                    filter: entry.filter,
                    sort: entry.sort,
                    hideNoisySingles: entry.hideNoisySingles
                  });
                }}
                className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-sm text-muted transition hover:border-accent/35 hover:text-white"
              >
                {entry.query}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="chip border-accent/25 bg-accent/10 text-accent-glow">{sectionTitle(filter)}</span>
          <span className="chip">{totalCount} results</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                filter === item.id
                  ? "bg-accent/15 text-accent-glow border border-accent/40 shadow-[0_0_12px_rgba(94,186,255,0.15)]"
                  : "border border-white/[0.08] bg-white/[0.02] text-muted hover:border-white/[0.15] hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}

          <label className="ml-auto flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-sm text-muted">
            <span>Sort</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as ReleaseSort)}
              className="bg-transparent text-white outline-none"
            >
              {RELEASE_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} className="bg-[#060c1a] text-white">
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => setHideNoisySingles((current) => !current)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              hideNoisySingles
                ? "bg-accent/15 text-accent-glow border border-accent/40 shadow-[0_0_12px_rgba(94,186,255,0.15)]"
                : "border border-white/[0.08] bg-white/[0.02] text-muted hover:border-white/[0.15] hover:bg-white/[0.04] hover:text-white"
            }`}
          >
            Hide Noisy Singles
          </button>
        </div>
      </section>

      {(filter === "all" || filter === "artists") && results.artists.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Artists</h2>
          <div className="space-y-5">
            {results.artists.map((artist, artistIndex) => {
              const key = artistKey(artist);
              const image = chooseArtistImage(artist.images);
              const artistHref = buildArtistHref({
                artistName: artist.artistName,
                foreignArtistId: artist.foreignArtistId,
                from: discoverStateHref
              });
              const artistReleases =
                releasesByArtist.get(artist.foreignArtistId ?? "") ??
                releasesByArtist.get(artist.artistName.toLowerCase()) ??
                [];
              const availableAlbumCount = artistReleases.filter((album) => album.hasFiles).length;
              const trackedAlbumCount = artistReleases.filter((album) => album.isTracked).length;

              return (
                <Card
                  key={`artist:${key}`}
                  className="space-y-4 motion-safe:animate-fade-in-up"
                    style={{ animationDelay: `${Math.min(artistIndex * 50, 280)}ms` }}
                >
                  <div className="flex gap-4">
                    <CoverImage
                      alt={artist.artistName}
                      src={image}
                      sizes="96px"
                      className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-white/[0.1] bg-panel-2"
                      imageClassName="object-cover transition-transform duration-300 hover:scale-105"
                    />
                    <div className="min-w-0 flex-1">
                      {artistHref ? (
                        <Link
                          href={artistHref}
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
                        {artistReleases.length > 0
                          ? availableAlbumCount > 0
                            ? `${availableAlbumCount} release${availableAlbumCount === 1 ? "" : "s"} available${trackedAlbumCount > availableAlbumCount ? ` · ${trackedAlbumCount} tracked` : ""}`
                            : trackedAlbumCount > 0
                              ? `${trackedAlbumCount} release${trackedAlbumCount === 1 ? "" : "s"} tracked`
                              : `${artistReleases.length} release${artistReleases.length === 1 ? "" : "s"} found`
                          : "No release lookup results for this artist"}
                      </p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      ) : null}

      {(filter === "all" || filter === "albums") && displayedAlbums.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Albums</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {visibleAlbums.map((album, index) => {
              const key = albumKey({
                foreignAlbumId: album.foreignAlbumId,
                artistName: album.artistName,
                title: album.title
              });
              const image = chooseAlbumImage(album.images);
              const albumHref = buildAlbumHref({
                artistName: album.artistName,
                foreignArtistId: album.foreignArtistId,
                foreignAlbumId: album.foreignAlbumId,
                from: discoverStateHref
              });

              return (
                <Card
                  key={`album:${key}`}
                  className="group motion-safe:animate-fade-in-up"
                  style={{ animationDelay: `${Math.min(index * 40, 240)}ms` }}
                >
                  <div className="flex gap-4">
                    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-white/[0.1] bg-panel-2">
                      {albumHref ? (
                        <Link href={albumHref} className="block h-full w-full">
                          <CoverImage
                            alt={album.title}
                            src={image}
                            sizes="96px"
                            className="relative h-full w-full"
                            imageClassName="object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        </Link>
                      ) : (
                        <CoverImage
                          alt={album.title}
                          src={image}
                          sizes="96px"
                          className="relative h-full w-full"
                          imageClassName="object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      )}
                      {album.hasFiles && (
                        <div className="absolute left-1 top-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
                          <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                      {!album.hasFiles && album.isTracked && (
                        <div className="absolute left-1 top-1 rounded-full bg-slate-900/85 px-1.5 py-0.5 text-[10px] font-medium text-slate-100">
                          Tracked
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
                        disabled={submitting === `album:${key}` || album.isTracked}
                        className="quick-icon"
                        aria-label={`Quick download ${album.title}`}
                        title={albumActionTitle(album)}
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
                      {albumHref ? (
                        <Link href={albumHref} className="text-lg font-semibold tracking-tight hover:text-accent-glow">
                          {album.title}
                        </Link>
                      ) : (
                        <h3 className="text-lg font-semibold tracking-tight">{album.title}</h3>
                      )}
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
                        disabled={submitting === `album:${key}` || album.isTracked}
                        className="btn-primary mt-3 py-2 text-sm"
                      >
                        {submitting === `album:${key}`
                            ? "Requesting..."
                            : albumActionLabel(album)}
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          {hasMoreAlbums ? (
            <div ref={albumSentinelRef} className="flex justify-center pt-2 text-xs text-muted/70">
              Loading more albums...
            </div>
          ) : null}
        </section>
      ) : null}

      {(filter === "all" || filter === "singles") && displayedSingles.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Singles</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {visibleSingles.map((single, index) => {
              const key = albumKey({
                foreignAlbumId: single.foreignAlbumId,
                artistName: single.artistName,
                title: single.title
              });
              const image = chooseAlbumImage(single.images);
              const singleHref = buildAlbumHref({
                artistName: single.artistName,
                foreignArtistId: single.foreignArtistId,
                foreignAlbumId: single.foreignAlbumId,
                from: discoverStateHref
              });

              return (
                <Card
                  key={`single:${key}`}
                  className="group motion-safe:animate-fade-in-up"
                  style={{ animationDelay: `${Math.min(index * 40, 240)}ms` }}
                >
                  <div className="flex gap-4">
                    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-white/[0.1] bg-panel-2">
                      {singleHref ? (
                        <Link href={singleHref} className="block h-full w-full">
                          <CoverImage
                            alt={single.title}
                            src={image}
                            sizes="96px"
                            className="relative h-full w-full"
                            imageClassName="object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        </Link>
                      ) : (
                        <CoverImage
                          alt={single.title}
                          src={image}
                          sizes="96px"
                          className="relative h-full w-full"
                          imageClassName="object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      )}
                      {single.hasFiles && (
                        <div className="absolute left-1 top-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
                          <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                      {!single.hasFiles && single.isTracked && (
                        <div className="absolute left-1 top-1 rounded-full bg-slate-900/85 px-1.5 py-0.5 text-[10px] font-medium text-slate-100">
                          Tracked
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          void requestAlbum(
                            {
                              artistName: single.artistName,
                              albumTitle: single.title,
                              foreignArtistId: single.foreignArtistId,
                              foreignAlbumId: single.foreignAlbumId
                            },
                            `single:${key}`
                          )
                        }
                        disabled={submitting === `single:${key}` || single.isTracked}
                        className="quick-icon"
                        aria-label={`Quick download ${single.title}`}
                        title={albumActionTitle(single)}
                      >
                        {submitting === `single:${key}` ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <IconDownload className="h-4 w-4" />
                        )}
                        <span className="sr-only">Quick download single</span>
                      </button>
                    </div>
                    <div className="min-w-0 flex-1">
                      {singleHref ? (
                        <Link href={singleHref} className="text-lg font-semibold tracking-tight hover:text-accent-glow">
                          {single.title}
                        </Link>
                      ) : (
                        <h3 className="text-lg font-semibold tracking-tight">{single.title}</h3>
                      )}
                      <p className="text-sm text-muted">{single.artistName}</p>
                      <p className="mt-1.5 line-clamp-2 text-xs text-muted/80">
                        {single.overview ?? "No release overview available."}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          void requestAlbum(
                            {
                              artistName: single.artistName,
                              albumTitle: single.title,
                              foreignArtistId: single.foreignArtistId,
                              foreignAlbumId: single.foreignAlbumId
                            },
                            `single:${key}`
                          )
                        }
                        disabled={submitting === `single:${key}` || single.isTracked}
                        className="btn-primary mt-3 py-2 text-sm"
                      >
                        {submitting === `single:${key}`
                          ? "Requesting..."
                          : albumActionLabel(single)}
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          {hasMoreSingles ? (
            <div ref={singleSentinelRef} className="flex justify-center pt-2 text-xs text-muted/70">
              Loading more singles...
            </div>
          ) : null}
        </section>
      ) : null}

      {totalCount === 0 && query.trim().length > 0 && !loading ? (
        <div className="empty-state">
          <div className="mb-5 flex h-20 w-20 mx-auto items-center justify-center rounded-full border border-white/[0.08] bg-panel-2/30">
            <svg className="h-10 w-10 text-muted/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <p className="text-base font-medium text-muted">No results found</p>
          <p className="mt-1.5 text-sm text-muted/70">Try a different search term for &quot;{query}&quot;</p>
        </div>
      ) : null}
    </div>
  );
}
