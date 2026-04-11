"use client";

import type { Route } from "next";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { CoverImage } from "@/components/ui/cover-image";
import { IconDownload } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast-provider";
import type { DiscoverHomeData, DiscoverHomeRelease } from "@/lib/discover/home";
import {
  filterNoisySingles,
  RELEASE_SORT_OPTIONS,
  type ReleaseSort,
  sortReleases
} from "@/lib/discover/release-browser";
import { pickPreferredImageUrl, type ImageAsset } from "@/lib/image-selection";
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

type ReleaseRequestTarget = Pick<
  Album,
  "title" | "artistName" | "foreignArtistId" | "foreignAlbumId" | "isTracked" | "hasFiles"
>;

const emptyResults: DiscoveryResults = {
  artists: [],
  albums: [],
  singles: []
};

const DEFAULT_RELEASE_SORT: ReleaseSort = "newest";

const chooseArtistImage = (images?: ImageAsset[]) =>
  pickPreferredImageUrl(images, ["poster", "cover", "fanart", "banner"]);

const chooseAlbumImage = (images?: ImageAsset[]) =>
  pickPreferredImageUrl(images, ["cover", "poster", "fanart", "banner"]);

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

const albumActionLabel = (album: Pick<Album, "isTracked" | "hasFiles">, label = "Album") => {
  if (album.hasFiles) return "Available";
  if (album.isTracked) return "Monitored";
  return `Request ${label}`;
};

const getReleaseRequestInput = (release: ReleaseRequestTarget) => ({
  artistName: release.artistName,
  albumTitle: release.title,
  foreignArtistId: release.foreignArtistId,
  foreignAlbumId: release.foreignAlbumId
});

const getQuickRequestTitle = (
  release: Pick<Album, "isTracked" | "hasFiles">,
  label: "album" | "single"
): string => {
  if (release.hasFiles) {
    return "Already available";
  }

  if (release.isTracked) {
    return "Already monitored";
  }

  return `Request ${label}`;
};

const getRequestButtonClassName = (release: Pick<Album, "hasFiles">): string =>
  `mt-3 py-2 text-sm ${release.hasFiles ? "btn-ghost" : "btn-primary"}`;

const formatHomeCount = (value: number): string => value.toLocaleString();

const formatAddedLabel = (value?: string): string | null => {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric"
  }).format(new Date(timestamp));
};

type DiscoverHomeStatCardProps = {
  label: string;
  value: number;
  description: string;
};

function DiscoverHomeStatCard({ label, value, description }: DiscoverHomeStatCardProps) {
  return (
    <Card className="space-y-4 p-6 sm:p-7">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">{label}</p>
      <div className="space-y-2">
        <p className="font-display text-3xl font-bold tracking-tight text-text sm:text-[2.1rem]">
          {formatHomeCount(value)}
        </p>
        <p className="text-sm leading-relaxed text-muted">{description}</p>
      </div>
    </Card>
  );
}

type DiscoverFreshReleaseCardProps = {
  release: DiscoverHomeRelease;
  discoverStateHref: string;
};

function DiscoverFreshReleaseCard({ release, discoverStateHref }: DiscoverFreshReleaseCardProps) {
  const href = buildAlbumHref({
    artistName: release.artistName,
    foreignArtistId: release.foreignArtistId,
    foreignAlbumId: release.foreignAlbumId,
    from: discoverStateHref
  });
  const addedLabel = formatAddedLabel(release.addedAt);
  const image = chooseAlbumImage(release.images);
  const typeLabel = release.releaseGroup === "single" ? "Single" : "Album";

  return (
    <Card className="group h-full p-5 sm:p-6">
      <div className="flex gap-4 sm:gap-5">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-[var(--edge)] bg-panel-2 sm:h-28 sm:w-28">
          {href ? (
            <Link href={href} className="block h-full w-full">
              <CoverImage
                alt={release.title}
                src={image}
                sizes="(min-width: 640px) 112px, 96px"
                className="relative h-full w-full"
                imageClassName="object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </Link>
          ) : (
            <CoverImage
              alt={release.title}
              src={image}
              sizes="(min-width: 640px) 112px, 96px"
              className="relative h-full w-full"
              imageClassName="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted">
            <span className="chip">{typeLabel}</span>
            {addedLabel ? <span>Added {addedLabel}</span> : null}
          </div>

          {href ? (
            <Link href={href} className="block truncate text-base font-medium tracking-tight hover:text-accent-hover">
              {release.title}
            </Link>
          ) : (
            <h3 className="truncate text-base font-medium tracking-tight">{release.title}</h3>
          )}

          <p className="truncate text-sm text-muted">{release.artistName}</p>
          <p className="text-xs leading-relaxed text-muted">
            Recently added to your library and ready to play.
          </p>
        </div>
      </div>
    </Card>
  );
}

type DiscoverHomeSectionProps = {
  homeData: DiscoverHomeData;
  discoverStateHref: string;
};

function DiscoverHomeSection({ homeData, discoverStateHref }: DiscoverHomeSectionProps) {
  return (
    <div className="space-y-10 sm:space-y-12">
      <section className="grid gap-4 sm:gap-5 md:grid-cols-3">
        <DiscoverHomeStatCard
          label="Fresh picks"
          value={homeData.freshPickCount}
          description="Newly downloaded albums and singles added in the last 7 days."
        />
        <DiscoverHomeStatCard
          label="Queued requests"
          value={homeData.queuedRequestCount}
          description="Requests still moving through approval or Lidarr submission."
        />
        <DiscoverHomeStatCard
          label="Ready to play"
          value={homeData.readyToPlayCount}
          description="Albums and singles already available in your library."
        />
      </section>

      <section className="space-y-5 sm:space-y-6">
        <div className="space-y-2">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-text sm:text-[2rem]">
            Fresh this week
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed text-muted sm:text-[0.95rem]">
            The latest downloaded albums and singles that just landed in your library.
          </p>
        </div>

        {homeData.freshThisWeek.length > 0 ? (
          <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
            {homeData.freshThisWeek.map((release) => (
              <DiscoverFreshReleaseCard
                key={release.id}
                release={release}
                discoverStateHref={discoverStateHref}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state empty-state-warm px-6 py-8 sm:px-8 sm:py-10">
            <p className="text-base font-medium text-muted">No recent library additions yet.</p>
            <p className="mt-1.5 text-sm text-muted">
              {homeData.libraryStatus === "connected"
                ? "Once new albums or singles finish downloading, they will show up here."
                : homeData.libraryStatus === "unavailable"
                  ? "Lidarr is currently unavailable, so recent additions and library totals cannot be loaded right now."
                  : "Connect Lidarr to show recent additions and library totals here."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

type DiscoverClientProps = {
  homeData: DiscoverHomeData;
};

export function DiscoverClient({ homeData }: DiscoverClientProps) {
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
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isSuggestionsHovered, setIsSuggestionsHovered] = useState(false);

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
    const search = params.toString();
    return search ? `${pathname}?${search}` : pathname;
  }, [filter, pathname, query, sort]);

  const buildDiscoverStateHref = useCallback((
    nextQuery: string,
    nextFilter: FilterType,
    nextSort: ReleaseSort
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
    const search = params.toString();
    return search ? `${pathname}?${search}` : pathname;
  }, [pathname]);

  const fetchDiscovery = useCallback(async (
    term: string,
    showLoader = true,
    stateOverride?: {
      filter?: FilterType;
      sort?: ReleaseSort;
    }
  ) => {
    const nextFilter = stateOverride?.filter ?? filter;
    const nextSort = stateOverride?.sort ?? sort;

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

    window.history.replaceState(null, "", buildDiscoverStateHref(term, nextFilter, nextSort));

    if (showLoader) setLoading(false);
  }, [buildDiscoverStateHref, filter, pathname, searchParams, sort, toast]);

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

  const runSearch = useCallback(async (event?: FormEvent) => {
    event?.preventDefault();
    setShowSuggestions(false);
    await fetchDiscovery(query, true);
  }, [query, fetchDiscovery]);

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
      toast.success("Request submitted — it's now in the queue.", "Requests");
    }

    setSubmitting(null);
  };

  const releasesByArtist = useMemo(() => {
    const map = new Map<string, Album[]>();

    for (const album of [...sortReleases(results.albums, sort), ...filterNoisySingles(sortReleases(results.singles, sort))]) {
      const key = album.foreignArtistId ?? album.artistName.toLowerCase();
      const current = map.get(key) ?? [];
      current.push(album);
      map.set(key, current);
    }

    return map;
  }, [results.albums, results.singles, sort]);

  const displayedAlbums = useMemo(() => sortReleases(results.albums, sort), [results.albums, sort]);
  const displayedSingles = useMemo(
    () => filterNoisySingles(sortReleases(results.singles, sort)),
    [results.singles, sort]
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
  } = useProgressiveCount(displayedAlbums.length, [query, filter, sort, displayedAlbums.length]);
  const {
    visibleCount: visibleSingleCount,
    sentinelRef: singleSentinelRef,
    hasMore: hasMoreSingles
  } = useProgressiveCount(displayedSingles.length, [query, filter, sort, displayedSingles.length]);
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
  const isSearchActive = query.trim().length >= 2;

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

  const chooseSuggestion = useCallback((suggestion: Suggestion) => {
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
  }, [discoverStateHref, router]);

  return (
    <div className="page-enter space-y-8 sm:space-y-10">
      <section className="space-y-4 sm:space-y-5">
        {!isSearchActive ? <span className="chip">Home</span> : null}
        <div className="space-y-2 sm:space-y-3">
          <h1 className="max-w-3xl font-display text-4xl font-bold tracking-tight sm:text-[2.8rem]">
            {isSearchActive ? "Discover Music" : "Find something new tonight"}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
            {isSearchActive
              ? "Search artists, albums, and singles."
              : "Search artists, albums, and singles, then keep an eye on what is new in your library."}
          </p>
        </div>
      </section>

      <form
        ref={searchRegionRef}
        onSubmit={runSearch}
        className="panel relative z-30 flex flex-col gap-3 p-4 sm:gap-4 sm:p-5 md:flex-row md:items-center md:p-6"
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
            role="combobox"
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
            className="field h-12 w-full pl-4 pr-4"
            aria-activedescendant={
              showSuggestions && suggestions.length > 0 && suggestions[activeSuggestionIndex]
                ? `suggestion-${suggestions[activeSuggestionIndex].id}`
                : undefined
            }
            aria-controls="search-suggestions"
            aria-expanded={showSuggestions && suggestions.length > 0}
            aria-autocomplete="list"
          />

          {showSuggestions && suggestions.length > 0 ? (
            <div
              id="search-suggestions"
              className="dropdown"
              role="listbox"
              aria-label="Search suggestions"
              aria-orientation="vertical"
              aria-activedescendant={
                suggestions[activeSuggestionIndex]
                  ? `suggestion-${suggestions[activeSuggestionIndex].id}`
                  : undefined
              }
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
                  <li
                    key={suggestion.id}
                    id={`suggestion-${suggestion.id}`}
                    role="option"
                    aria-selected={index === activeSuggestionIndex}
                  >
                    <button
                      type="button"
                      className={`flex w-full items-start justify-between rounded-xl px-3 py-2.5 text-left transition ${
                        index === activeSuggestionIndex
                          ? "bg-accent/15 text-accent-active"
                          : "text-muted hover:bg-[var(--hover-bg)] hover:text-text"
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

        <button type="submit" disabled={loading} className="btn-primary h-12 min-w-[9rem] px-5 py-3">
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

      {!isSearchActive ? (
        <DiscoverHomeSection homeData={homeData} discoverStateHref={discoverStateHref} />
      ) : null}

      {isSearchActive ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {filters.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  aria-pressed={filter === item.id}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                    filter === item.id
                      ? "bg-accent/15 text-accent-active border border-accent/40"
                      : "border border-[var(--edge)] bg-[var(--overlay-bg-subtle)] text-muted hover:border-[var(--edge-bright)] hover:bg-[var(--hover-bg)] hover:text-text"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 text-xs text-muted">
              <span>{totalCount} result{totalCount !== 1 ? "s" : ""}</span>
              <label htmlFor="sort-select" className="flex items-center gap-1.5 cursor-pointer">
                <span className="sr-only">Sort by</span>
                <select
                  id="sort-select"
                  value={sort}
                  onChange={(event) => setSort(event.target.value as ReleaseSort)}
                  className="field-select rounded-lg px-1.5 py-0.5 text-xs"
                >
                  {RELEASE_SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value} style={{ background: "var(--panel)", color: "var(--text)" }}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </section>
      ) : null}

      {(filter === "all" || filter === "artists") && results.artists.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Artists</h2>
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
                  className="space-y-4 motion-safe:animate-fade-in-up-overdrive"
                    style={{ animationDelay: `${Math.min(artistIndex * 50, 280)}ms` }}
                >
                  <div className="flex gap-4">
                    <CoverImage
                      alt={artist.artistName}
                      src={image}
                      sizes="(min-width: 640px) 128px, 96px"
                      className="relative h-24 w-24 sm:h-32 sm:w-32 shrink-0 overflow-hidden rounded-xl border border-[var(--edge)] bg-panel-2"
                      imageClassName="object-cover transition-transform duration-300 hover:scale-105"
                    />
                    <div className="min-w-0 flex-1">
                      {artistHref ? (
                        <Link
                          href={artistHref}
                          className="font-display truncate text-base font-bold tracking-tight hover:text-accent-hover"
                        >
                          {artist.artistName}
                        </Link>
                      ) : (
                        <h3 className="font-display truncate text-base font-bold tracking-tight">{artist.artistName}</h3>
                      )}
                      <p className="mt-1.5 line-clamp-2 text-sm text-muted">
                        {artist.overview ?? "No description available."}
                      </p>
                      <p className="mt-2 text-xs text-muted">
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
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Albums</h2>
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {visibleAlbums.map((album, index) => {
              const key = albumKey({
                foreignAlbumId: album.foreignAlbumId,
                artistName: album.artistName,
                title: album.title
              });
              const albumRequestKey = `album:${key}`;
              const albumRequestInput = getReleaseRequestInput(album);
              const isAlbumSubmitting = submitting === albumRequestKey;
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
                  style={{ animationDelay: `${Math.min(index * 50, 280)}ms` }}
                >
                  <div className="flex gap-4">
                    <div className="relative h-24 w-24 sm:h-32 sm:w-32 shrink-0 overflow-hidden rounded-xl border border-[var(--edge)] bg-panel-2">
                      {albumHref ? (
                        <Link href={albumHref} className="block h-full w-full">
                          <CoverImage
                            alt={album.title}
                            src={image}
                            sizes="(min-width: 640px) 128px, 96px"
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
                        <div className="absolute left-1 top-1 inline-flex items-center gap-1 rounded-full badge-available px-1.5 py-0.5 text-[10px] font-medium">
                          <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                      {!album.hasFiles && album.isTracked && (
                        <div className="absolute left-1 top-1 rounded-full badge-tracked px-1.5 py-0.5 text-[10px] font-medium">
                          Tracked
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => void requestAlbum(albumRequestInput, albumRequestKey)}
                        disabled={isAlbumSubmitting || album.hasFiles || album.isTracked}
                        className="quick-icon"
                        aria-label={`Request ${album.title}`}
                        title={getQuickRequestTitle(album, "album")}
                      >
                        {isAlbumSubmitting ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <IconDownload className="h-4 w-4" />
                        )}
                        <span className="sr-only">Quick download album</span>
                      </button>
                    </div>
                    <div className="min-w-0 flex-1">
                      {albumHref ? (
                        <Link href={albumHref} className="truncate text-base font-medium tracking-tight hover:text-accent-hover">
                          {album.title}
                        </Link>
                      ) : (
                        <h3 className="truncate text-base font-medium tracking-tight">{album.title}</h3>
                      )}
                      <p className="truncate text-sm text-muted">{album.artistName}</p>
                      <p className="mt-1.5 line-clamp-2 text-xs text-muted">
                        {album.overview ?? "No album overview available."}
                      </p>
                      <button
                        type="button"
                        onClick={() => void requestAlbum(albumRequestInput, albumRequestKey)}
                        disabled={isAlbumSubmitting || album.isTracked}
                        className={getRequestButtonClassName(album)}
                      >
                        {isAlbumSubmitting ? "Requesting..." : albumActionLabel(album)}
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          {hasMoreAlbums ? (
            <div ref={albumSentinelRef} className="flex justify-center items-center gap-2 pt-3 text-xs text-muted">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Loading more albums...
            </div>
          ) : null}
        </section>
      ) : null}

      {(filter === "all" || filter === "singles") && displayedSingles.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Singles</h2>
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {visibleSingles.map((single, index) => {
              const key = albumKey({
                foreignAlbumId: single.foreignAlbumId,
                artistName: single.artistName,
                title: single.title
              });
              const singleRequestKey = `single:${key}`;
              const singleRequestInput = getReleaseRequestInput(single);
              const isSingleSubmitting = submitting === singleRequestKey;
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
                  style={{ animationDelay: `${Math.min(index * 50, 280)}ms` }}
                >
                  <div className="flex gap-4">
                    <div className="relative h-24 w-24 sm:h-32 sm:w-32 shrink-0 overflow-hidden rounded-xl border border-[var(--edge)] bg-panel-2">
                      {singleHref ? (
                        <Link href={singleHref} className="block h-full w-full">
                          <CoverImage
                            alt={single.title}
                            src={image}
                            sizes="(min-width: 640px) 128px, 96px"
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
                        <div className="absolute left-1 top-1 inline-flex items-center gap-1 rounded-full badge-available px-1.5 py-0.5 text-[10px] font-medium">
                          <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                      {!single.hasFiles && single.isTracked && (
                        <div className="absolute left-1 top-1 rounded-full badge-tracked px-1.5 py-0.5 text-[10px] font-medium">
                          Tracked
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => void requestAlbum(singleRequestInput, singleRequestKey)}
                        disabled={isSingleSubmitting || single.hasFiles || single.isTracked}
                        className="quick-icon"
                        aria-label={`Request ${single.title}`}
                        title={getQuickRequestTitle(single, "single")}
                      >
                        {isSingleSubmitting ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <IconDownload className="h-4 w-4" />
                        )}
                        <span className="sr-only">Quick download single</span>
                      </button>
                    </div>
                    <div className="min-w-0 flex-1">
                      {singleHref ? (
                        <Link href={singleHref} className="truncate text-base font-medium tracking-tight hover:text-accent-hover">
                          {single.title}
                        </Link>
                      ) : (
                        <h3 className="truncate text-base font-medium tracking-tight">{single.title}</h3>
                      )}
                      <p className="truncate text-sm text-muted">{single.artistName}</p>
                      <p className="mt-1.5 line-clamp-2 text-xs text-muted">
                        {single.overview ?? "No release overview available."}
                      </p>
                      <button
                        type="button"
                        onClick={() => void requestAlbum(singleRequestInput, singleRequestKey)}
                        disabled={isSingleSubmitting || single.isTracked}
                        className={getRequestButtonClassName(single)}
                      >
                        {isSingleSubmitting ? "Requesting..." : albumActionLabel(single, "Single")}
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          {hasMoreSingles ? (
            <div ref={singleSentinelRef} className="flex justify-center items-center gap-2 pt-3 text-xs text-muted">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Loading more singles...
            </div>
          ) : null}
        </section>
      ) : null}

      {totalCount === 0 && isSearchActive && !loading ? (
        <div className="empty-state">
          <div className="mb-5 flex h-20 w-20 mx-auto items-center justify-center rounded-full border border-[var(--edge)] bg-panel-2/30">
            <svg className="h-10 w-10 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <p className="text-base font-medium text-muted">No results for &quot;{query}&quot;</p>
          <p className="mt-1.5 text-sm text-muted">Check the spelling or try a different artist name.</p>
          <button
            type="button"
            onClick={() => { setQuery(""); }}
            className="btn-ghost mt-4 mx-auto"
          >
            Clear search
          </button>
        </div>
      ) : null}

    </div>
  );
}
