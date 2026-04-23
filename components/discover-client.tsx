"use client";

import type { Route } from "next";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { CoverImage } from "@/components/ui/cover-image";
import { IconCheck, IconChevronDown, IconDownload, IconSearch } from "@/components/ui/icons";
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

type DiscoverHistoryState = {
  discoverSnapshot?: {
    query: string;
    filter: FilterType;
    sort: ReleaseSort;
    results: DiscoveryResults;
  };
};

const DISCOVER_SNAPSHOT_STORAGE_KEY = "melodarr:discover-snapshot";

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
  pickPreferredImageUrl(images, ["cover", "poster", "fanart", "banner"]);

const chooseAlbumImage = (images?: ImageAsset[]) =>
  pickPreferredImageUrl(images, ["cover", "poster", "fanart", "banner"]);

const albumKey = (album: { foreignAlbumId?: string; artistName: string; title: string }) =>
  album.foreignAlbumId ?? `${album.artistName}:${album.title}`;

const artistKey = (artist: { foreignArtistId?: string; artistName: string }) =>
  artist.foreignArtistId ?? artist.artistName;

const getReleaseYearLabel = (releaseDate?: string): string => {
  if (!releaseDate) {
    return "Unknown year";
  }

  const timestamp = Date.parse(releaseDate);
  if (!Number.isNaN(timestamp)) {
    return String(new Date(timestamp).getFullYear());
  }

  return releaseDate.match(/\d{4}/)?.[0] ?? "Unknown year";
};

const hasRenderableArtistCard = (artist: Artist, releases: Album[]): boolean =>
  Boolean(chooseArtistImage(artist.images)) && releases.length > 1;

export const buildArtistHref = ({ artistName, foreignArtistId, from }: ArtistRouteInput): Route | undefined =>
  foreignArtistId
    ? (`/discover/${encodeURIComponent(foreignArtistId)}?artistName=${encodeURIComponent(artistName)}${from ? `&from=${encodeURIComponent(from)}` : ""}` as Route)
    : undefined;

export const buildAlbumHref = ({ artistName, foreignArtistId, foreignAlbumId, from }: AlbumRouteInput): Route | undefined =>
  foreignArtistId && foreignAlbumId
    ? (`/discover/${encodeURIComponent(foreignArtistId)}/${encodeURIComponent(foreignAlbumId)}?artistName=${encodeURIComponent(artistName)}${from ? `&from=${encodeURIComponent(from)}` : ""}` as Route)
    : undefined;

const readStoredDiscoverSnapshots = (): Record<string, DiscoverHistoryState["discoverSnapshot"]> => {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.sessionStorage.getItem(DISCOVER_SNAPSHOT_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    return JSON.parse(raw) as Record<string, DiscoverHistoryState["discoverSnapshot"]>;
  } catch {
    return {};
  }
};

const writeStoredDiscoverSnapshots = (snapshots: Record<string, DiscoverHistoryState["discoverSnapshot"]>) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(DISCOVER_SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshots));
  } catch {
    // Ignore storage write failures.
  }
};

const storeDiscoverSnapshot = (href: string, snapshot?: DiscoverHistoryState["discoverSnapshot"]) => {
  const snapshots = readStoredDiscoverSnapshots();

  if (snapshot) {
    snapshots[href] = snapshot;
  } else {
    delete snapshots[href];
  }

  writeStoredDiscoverSnapshots(snapshots);
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

const formatHomeCount = (value: number): string => value.toLocaleString();

type DiscoverHomeStatCardProps = {
  label: string;
  value: number;
  description: string;
};

function DiscoverHomeStatCard({ label, value, description }: DiscoverHomeStatCardProps) {
  return (
    <Card className="min-w-[9rem] space-y-1.5 rounded-2xl p-4 sm:p-[1.125rem]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted">{label}</p>
      <div className="space-y-1">
        <p className="font-display text-2xl font-bold tracking-tight text-text sm:text-[1.75rem]">
          {formatHomeCount(value)}
        </p>
        <p className="text-xs leading-relaxed text-muted">{description}</p>
      </div>
    </Card>
  );
}

type DiscoverFreshCoverflowProps = {
  releases: DiscoverHomeRelease[];
  discoverStateHref: string;
};

function DiscoverFreshCoverflow({ releases, discoverStateHref }: DiscoverFreshCoverflowProps) {
  const HOVER_ADVANCE_DELAY_MS = 120;
  const DETAIL_FADE_MS = 800;
  const [activeIndex, setActiveIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const visibleReleases = releases.slice(0, 10);
  const clampedActiveIndex = Math.min(activeIndex, Math.max(visibleReleases.length - 1, 0));
  const activeRelease = visibleReleases[clampedActiveIndex] ?? visibleReleases[0] ?? null;
  const wheelDeltaRef = useRef(0);
  const hoverLockedRef = useRef(false);
  const hoverPrimedRef = useRef(false);
  const hoverTimeoutRef = useRef<number | null>(null);
  const lastHoverPositionRef = useRef<{ x: number; y: number } | null>(null);
  const pointerStartXRef = useRef<number | null>(null);
  const pointerIdRef = useRef<number | null>(null);

  const clearHoverTimeout = useCallback(() => {
    if (hoverTimeoutRef.current !== null) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }, []);

  const goToIndex = useCallback((nextIndex: number) => {
    setDragOffset(0);
    setActiveIndex(Math.max(0, Math.min(nextIndex, visibleReleases.length - 1)));
  }, [visibleReleases.length]);

  const goToPrevious = useCallback(() => {
    goToIndex(clampedActiveIndex - 1);
  }, [clampedActiveIndex, goToIndex]);

  const goToNext = useCallback(() => {
    goToIndex(clampedActiveIndex + 1);
  }, [clampedActiveIndex, goToIndex]);

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (visibleReleases.length <= 1) {
      return;
    }

    const horizontalIntent = Math.abs(event.deltaX) > Math.abs(event.deltaY);
    if (!horizontalIntent) {
      return;
    }

    event.preventDefault();
    wheelDeltaRef.current += event.deltaX;

    if (Math.abs(wheelDeltaRef.current) < 36) {
      return;
    }

    if (wheelDeltaRef.current > 0) {
      goToNext();
    } else {
      goToPrevious();
    }

    wheelDeltaRef.current = 0;
  }, [goToNext, goToPrevious, visibleReleases.length]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!(event.target instanceof HTMLElement) || event.target.closest("a, button")) {
      return;
    }

    pointerStartXRef.current = event.clientX;
    pointerIdRef.current = event.pointerId;
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerStartXRef.current === null) {
      return;
    }

    setDragOffset(event.clientX - pointerStartXRef.current);
  }, []);

  const handleCarouselMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const nextPosition = { x: event.clientX, y: event.clientY };
    const lastPosition = lastHoverPositionRef.current;

    if (!lastPosition) {
      lastHoverPositionRef.current = nextPosition;
      hoverLockedRef.current = false;
      return;
    }

    if (Math.abs(nextPosition.x - lastPosition.x) >= 4 || Math.abs(nextPosition.y - lastPosition.y) >= 4) {
      hoverLockedRef.current = false;
      lastHoverPositionRef.current = nextPosition;
    }
  }, []);

  const handleCarouselMouseLeave = useCallback(() => {
    clearHoverTimeout();
    hoverLockedRef.current = false;
    hoverPrimedRef.current = false;
    lastHoverPositionRef.current = null;
  }, [clearHoverTimeout]);

  const handleCoverHover = useCallback((index: number, options: { isHoverNavigable: boolean; isActive: boolean }) => {
    if (options.isActive) {
      hoverPrimedRef.current = true;
      clearHoverTimeout();
      return;
    }

    if (!options.isHoverNavigable || hoverLockedRef.current || !hoverPrimedRef.current) {
      return;
    }

    clearHoverTimeout();
    hoverTimeoutRef.current = window.setTimeout(() => {
      hoverLockedRef.current = true;
      goToIndex(index);
      hoverTimeoutRef.current = null;
    }, HOVER_ADVANCE_DELAY_MS);
  }, [HOVER_ADVANCE_DELAY_MS, clearHoverTimeout, goToIndex]);

  const handleCoverLeave = useCallback(() => {
    clearHoverTimeout();
  }, [clearHoverTimeout]);

  useEffect(() => () => {
    clearHoverTimeout();
  }, [clearHoverTimeout]);

  const handlePointerEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== null && event.currentTarget.hasPointerCapture(pointerIdRef.current)) {
      event.currentTarget.releasePointerCapture(pointerIdRef.current);
    }

    const finalOffset = dragOffset;
    pointerStartXRef.current = null;
    pointerIdRef.current = null;
    setIsDragging(false);
    setDragOffset(0);

    if (Math.abs(finalOffset) < 50) {
      return;
    }

    if (finalOffset < 0) {
      goToNext();
      return;
    }

    goToPrevious();
  }, [dragOffset, goToNext, goToPrevious]);

  if (visibleReleases.length === 0 || !activeRelease) {
    return null;
  }

  return (
    <div className="space-y-5">
      <div
        className="relative h-[21rem] overflow-hidden rounded-[2rem] border border-[var(--edge)] bg-panel-2/45 px-4 py-5 sm:h-[24rem] sm:px-8 sm:py-6"
        onMouseMove={handleCarouselMouseMove}
        onMouseLeave={handleCarouselMouseLeave}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        style={{ touchAction: "pan-y" }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[var(--panel)]/35 to-transparent" />
        <div className="absolute inset-0 [perspective:1400px]">
          {visibleReleases.map((release, index) => {
            const offset = index - clampedActiveIndex;
            const distance = Math.abs(offset);

            if (distance > 4) {
              return null;
            }

            const href = buildAlbumHref({
              artistName: release.artistName,
              foreignArtistId: release.foreignArtistId,
              foreignAlbumId: release.foreignAlbumId,
              from: discoverStateHref
            });
            const image = chooseAlbumImage(release.images);
            const translateX = offset * 196 + dragOffset * Math.max(0.35, 1 - distance * 0.22);
            const translateY = distance === 0 ? -8 : 6 + distance * 8;
            const rotateY = offset * -24;
            const scale = 1 - distance * 0.12;
            const opacity = Math.max(0, 1 - distance * 0.24);
            const blur = distance === 0 ? 0 : Math.min(distance * 0.8, 2.2);
            const isActive = distance === 0;
            const isHoverNavigable = distance === 1;

            const card = (
              <>
                <div className="relative h-full w-full overflow-hidden rounded-[1.6rem] border border-[var(--edge-bright)] bg-panel shadow-[0_24px_55px_rgba(0,0,0,0.24)]">
                  <CoverImage
                    alt={release.title}
                    src={image}
                    sizes="(min-width: 1024px) 20rem, (min-width: 640px) 17rem, 14rem"
                    className="relative h-full w-full"
                    imageClassName="object-cover"
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 to-transparent" />
                </div>
                <div className={`pointer-events-none absolute inset-x-4 bottom-4 rounded-2xl border border-[var(--edge)] bg-[color:var(--panel)]/84 px-3 py-2 text-left backdrop-blur-md transition-opacity ease-in-out ${isActive ? "opacity-100" : "opacity-0"}`}
                  style={{ transitionDuration: `${DETAIL_FADE_MS}ms` }}>
                  <p className="truncate text-sm font-medium text-text">{release.title}</p>
                  <p className="truncate text-xs text-muted">{release.artistName}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.24em] text-muted">
                    {release.releaseGroup === "single" ? "Single" : "Album"}
                  </p>
                </div>
              </>
            );

            return (
              <div
                key={release.id}
                className="absolute left-1/2 top-1/2 h-[13.5rem] w-[13.5rem] -translate-x-1/2 -translate-y-1/2 sm:h-[17rem] sm:w-[17rem]"
                style={{
                  transform: `translate3d(${translateX}px, ${translateY}px, ${-distance * 90}px) rotateY(${rotateY}deg) scale(${scale})`,
                  opacity,
                  filter: `blur(${blur}px) saturate(${isActive ? 1 : 0.9})`,
                  zIndex: 20 - distance,
                  transition: isDragging
                    ? "none"
                    : "transform 620ms cubic-bezier(0.16, 1, 0.3, 1), opacity 220ms ease-out, filter 260ms ease-out"
                }}
              >
                {href ? (
                  <Link
                    href={href}
                    onMouseEnter={() => handleCoverHover(index, { isHoverNavigable, isActive })}
                    onMouseLeave={handleCoverLeave}
                    onFocus={() => goToIndex(index)}
                    onClick={() => goToIndex(index)}
                    className="group relative block h-full w-full"
                  >
                    {card}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onMouseEnter={() => handleCoverHover(index, { isHoverNavigable, isActive })}
                    onMouseLeave={handleCoverLeave}
                    onFocus={() => goToIndex(index)}
                    onClick={() => goToIndex(index)}
                    className="group relative block h-full w-full text-left"
                  >
                    {card}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-h-[3.75rem] min-w-0 flex-1 overflow-hidden">
          {visibleReleases.map((release, index) => {
            const isActive = index === clampedActiveIndex;
            return (
              <div
                key={release.id}
                className={`absolute inset-0 flex flex-col justify-end space-y-1 transition-opacity ease-in-out ${
                  isActive ? "opacity-100" : "opacity-0"
                }`}
                style={{ transitionDuration: `${DETAIL_FADE_MS}ms` }}
              >
                <p className="truncate text-lg font-medium tracking-tight text-text">{release.title}</p>
                <p className="truncate text-sm text-muted">{release.artistName}</p>
                <p className="text-[10px] uppercase tracking-[0.24em] text-muted">
                  {release.releaseGroup === "single" ? "Single" : "Album"}
                </p>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goToPrevious}
            disabled={clampedActiveIndex === 0}
            className="btn-ghost rounded-xl px-3"
          >
            Previous
          </button>
          <span className="chip min-w-[5.5rem] justify-center">
            {clampedActiveIndex + 1} / {visibleReleases.length}
          </span>
          <button
            type="button"
            onClick={goToNext}
            disabled={clampedActiveIndex === visibleReleases.length - 1}
            className="btn-ghost rounded-xl px-3"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

type DiscoverHomeSectionProps = {
  homeData: DiscoverHomeData;
  discoverStateHref: string;
};

function DiscoverHomeSection({ homeData, discoverStateHref }: DiscoverHomeSectionProps) {
  return (
    <div className="space-y-10 sm:space-y-12">
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
          <DiscoverFreshCoverflow
            releases={homeData.freshThisWeek}
            discoverStateHref={discoverStateHref}
          />
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [submittedQuery, setSubmittedQuery] = useState("");
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
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);

  const requestSequence = useRef(0);
  const searchAbortRef = useRef<AbortController | null>(null);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const [isHistoryReady, setIsHistoryReady] = useState(false);

  const discoverStateHref = useMemo(() => {
    const params = new URLSearchParams();
    if (submittedQuery.trim().length >= 2) {
      params.set("q", submittedQuery.trim());
    }
    if (filter !== "all") {
      params.set("filter", filter);
    }
    if (sort !== DEFAULT_RELEASE_SORT) {
      params.set("sort", sort);
    }
    const search = params.toString();
    return search ? `${pathname}?${search}` : pathname;
  }, [filter, pathname, sort, submittedQuery]);

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

  const writeDiscoverHistory = useCallback((
    mode: "push" | "replace",
    href: string,
    snapshot?: DiscoverHistoryState["discoverSnapshot"]
  ) => {
    storeDiscoverSnapshot(href, snapshot);

    const historyMethod = mode === "push" ? window.history.pushState : window.history.replaceState;
    historyMethod.call(window.history, { discoverSnapshot: snapshot } satisfies DiscoverHistoryState, "", href);
  }, []);

  const fetchDiscovery = useCallback(async (
    term: string,
    showLoader = true,
    stateOverride?: {
      filter?: FilterType;
      sort?: ReleaseSort;
    }
  ) => {
    const trimmedTerm = term.trim();
    const nextFilter = stateOverride?.filter ?? filter;
    const nextSort = stateOverride?.sort ?? sort;

    if (!trimmedTerm || trimmedTerm.length < 2) {
      searchAbortRef.current?.abort();
      searchAbortRef.current = null;
      setResults(emptyResults);
      setSubmittedQuery("");
      setLoading(false);
      const emptyHref = buildDiscoverStateHref("", nextFilter, nextSort);
      writeDiscoverHistory("replace", emptyHref);
      return;
    }

    if (showLoader) {
      setLoading(true);
    }

    const currentSeq = ++requestSequence.current;
    searchAbortRef.current?.abort();
    const abortController = new AbortController();
    searchAbortRef.current = abortController;

    try {
      const response = await fetch(`/api/search/artists?q=${encodeURIComponent(trimmedTerm)}`, {
        signal: abortController.signal
      });
      const payload = (await response.json()) as DiscoveryResults & { error?: string };

      if (currentSeq !== requestSequence.current) {
        return;
      }

      if (!response.ok) {
        toast.error(payload.error ?? "Search failed", "Discover");
        return;
      }

      const nextResults = {
        artists: payload.artists ?? [],
        albums: payload.albums ?? [],
        singles: payload.singles ?? []
      };
      const nextHref = buildDiscoverStateHref(trimmedTerm, nextFilter, nextSort);
      const nextSnapshot = {
        query: trimmedTerm,
        filter: nextFilter,
        sort: nextSort,
        results: nextResults
      } satisfies DiscoverHistoryState["discoverSnapshot"];

      setResults(nextResults);
      setSubmittedQuery(trimmedTerm);
      writeDiscoverHistory("push", nextHref, nextSnapshot);
    } catch (error) {
      if (currentSeq !== requestSequence.current) {
        return;
      }

      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      toast.error(error instanceof Error ? error.message : "Search failed", "Discover");
    } finally {
      if (searchAbortRef.current === abortController) {
        searchAbortRef.current = null;
      }

      if (showLoader && currentSeq === requestSequence.current) {
        setLoading(false);
      }
    }
  }, [buildDiscoverStateHref, filter, sort, toast, writeDiscoverHistory]);

  useEffect(() => {
    const currentQuery = searchParams.get("q")?.trim() ?? "";
    const nextFilter = (() => {
      const value = searchParams.get("filter");
      return value === "artists" || value === "albums" || value === "singles"
        ? value
        : "all";
    })();
    const nextSort = (() => {
      const value = searchParams.get("sort");
      return RELEASE_SORT_OPTIONS.some((option) => option.value === value)
        ? (value as ReleaseSort)
        : DEFAULT_RELEASE_SORT;
    })();
    const currentHref = buildDiscoverStateHref(currentQuery, nextFilter, nextSort);
    const historyState = window.history.state as DiscoverHistoryState | null;
    const storedSnapshot = readStoredDiscoverSnapshots()[currentHref];
    const snapshot = historyState?.discoverSnapshot ?? storedSnapshot;

    if (nextFilter !== filter) {
      setFilter(nextFilter);
    }

    if (nextSort !== sort) {
      setSort(nextSort);
    }

    setQuery(currentQuery);

    if (
      snapshot
      && snapshot.query === currentQuery
      && snapshot.filter === nextFilter
      && snapshot.sort === nextSort
    ) {
      setSubmittedQuery(snapshot.query);
      setResults(snapshot.results);
      setIsHistoryReady(true);
      return;
    }

    setSubmittedQuery("");
    setResults(emptyResults);
    setIsHistoryReady(true);
  }, [buildDiscoverStateHref, filter, searchParams, sort]);

  useEffect(() => {
    if (!isHistoryReady) {
      return;
    }

    const snapshot = submittedQuery.trim().length >= 2
      ? {
          query: submittedQuery.trim(),
          filter,
          sort,
          results
        }
      : undefined;

    writeDiscoverHistory("replace", discoverStateHref, snapshot);
  }, [discoverStateHref, filter, isHistoryReady, results, sort, submittedQuery, writeDiscoverHistory]);

  useEffect(() => () => {
    searchAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!sortMenuRef.current?.contains(event.target as Node)) {
        setIsSortMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  const runSearch = useCallback(async (event?: FormEvent) => {
    event?.preventDefault();
    await fetchDiscovery(query, true);
  }, [query, fetchDiscovery]);

  const clearSearch = useCallback(() => {
    const emptyHref = buildDiscoverStateHref("", filter, sort);
    setQuery("");
    setSubmittedQuery("");
    setResults(emptyResults);
    setLoading(false);
    storeDiscoverSnapshot(discoverStateHref, undefined);
    writeDiscoverHistory("push", emptyHref);
  }, [buildDiscoverStateHref, discoverStateHref, filter, sort, writeDiscoverHistory]);

  const applyFilter = useCallback((nextFilter: FilterType) => {
    if (nextFilter === filter) {
      return;
    }

    const snapshot = submittedQuery.trim().length >= 2
      ? {
          query: submittedQuery.trim(),
          filter: nextFilter,
          sort,
          results
        }
      : undefined;

    writeDiscoverHistory(
      "push",
      buildDiscoverStateHref(submittedQuery, nextFilter, sort),
      snapshot
    );
    setFilter(nextFilter);
  }, [buildDiscoverStateHref, filter, results, sort, submittedQuery, writeDiscoverHistory]);

  const applySort = useCallback((nextSort: ReleaseSort) => {
    if (nextSort === sort) {
      return;
    }

    const snapshot = submittedQuery.trim().length >= 2
      ? {
          query: submittedQuery.trim(),
          filter,
          sort: nextSort,
          results
        }
      : undefined;

    writeDiscoverHistory(
      "push",
      buildDiscoverStateHref(submittedQuery, filter, nextSort),
      snapshot
    );
    setSort(nextSort);
  }, [buildDiscoverStateHref, filter, results, sort, submittedQuery, writeDiscoverHistory]);

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

    try {
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
        return;
      }

      if (payload.duplicate) {
        toast.info("This album has already been requested.", "Requests");
      } else {
        toast.success("Request submitted — it's now in the queue.", "Requests");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Request failed", "Requests");
    } finally {
      setSubmitting(null);
    }
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

  const getArtistReleases = useCallback((artist: Artist): Album[] => {
    const merged = [
      ...(artist.foreignArtistId ? releasesByArtist.get(artist.foreignArtistId) ?? [] : []),
      ...(releasesByArtist.get(artist.artistName.toLowerCase()) ?? [])
    ];

    const deduped = new Map<string, Album>();
    for (const release of merged) {
      deduped.set(albumKey({
        foreignAlbumId: release.foreignAlbumId,
        artistName: release.artistName,
        title: release.title
      }), release);
    }

    return [...deduped.values()];
  }, [releasesByArtist]);

  const filteredArtists = useMemo(
    () => results.artists.filter((artist) => hasRenderableArtistCard(artist, getArtistReleases(artist))),
    [getArtistReleases, results.artists]
  );

  const displayedAlbums = useMemo(() => sortReleases(results.albums, sort), [results.albums, sort]);
  const displayedSingles = useMemo(
    () => filterNoisySingles(sortReleases(results.singles, sort)),
    [results.singles, sort]
  );

  const counts = useMemo(
    () => ({
      artists: filteredArtists.length,
      albums: displayedAlbums.length,
      singles: displayedSingles.length
    }),
    [displayedAlbums.length, displayedSingles.length, filteredArtists.length]
  );

  const totalCount = counts.artists + counts.albums + counts.singles;
  const {
    visibleCount: visibleAlbumCount,
    sentinelRef: albumSentinelRef,
    hasMore: hasMoreAlbums
  } = useProgressiveCount(displayedAlbums.length, [submittedQuery, filter, sort, displayedAlbums.length]);
  const {
    visibleCount: visibleSingleCount,
    sentinelRef: singleSentinelRef,
    hasMore: hasMoreSingles
  } = useProgressiveCount(displayedSingles.length, [submittedQuery, filter, sort, displayedSingles.length]);
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
  const isSearchActive = submittedQuery.trim().length >= 2;
  const isSearchPending = loading && query.trim().length >= 2;
  const showDiscoverHome = !isSearchActive && !isSearchPending;

  return (
    <div className="page-enter space-y-8 sm:space-y-10">
      <section className="space-y-4 sm:space-y-5">
        {!isSearchActive ? <span className="chip">Home</span> : null}
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2 sm:space-y-3">
            <h1 className="max-w-3xl font-display text-4xl font-bold tracking-tight sm:text-[2.8rem]">
              {isSearchActive ? "Discover Music" : "Find something new"}
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
              {isSearchActive
                ? "Search artists, albums, and singles."
                : "Search artists, albums, and singles."}
            </p>
          </div>

          {!isSearchActive ? (
            <div className="grid w-full gap-3 sm:grid-cols-3 xl:w-auto xl:min-w-[30rem]">
              <DiscoverHomeStatCard
                label="Fresh picks"
                value={homeData.freshPickCount}
                description="Added this week."
              />
              <DiscoverHomeStatCard
                label="Queued requests"
                value={homeData.queuedRequestCount}
                description="Still processing."
              />
              <DiscoverHomeStatCard
                label="Ready to play"
                value={homeData.readyToPlayCount}
                description="Already in library."
              />
            </div>
          ) : null}
        </div>
      </section>

      <form onSubmit={runSearch} className="panel flex flex-col gap-3 p-4 sm:gap-4 sm:p-5 md:flex-row md:items-center md:p-6">
        <div className="min-w-0 flex-1">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search for music..."
            className="field h-12 w-full pl-4 pr-4"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`btn-primary group relative h-12 w-full justify-center overflow-hidden px-4 py-3 transition-[width,padding] duration-300 ease-out md:ml-auto md:justify-center ${
            loading ? "md:w-[9.5rem] md:px-5" : "md:w-12 md:px-0 md:hover:w-[9.5rem] md:hover:px-5"
          }`}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Searching...
            </span>
          ) : (
            <>
              <span className="hidden md:absolute md:inset-0 md:flex md:items-center md:justify-center md:gap-0 md:px-5 md:transition-[gap] md:duration-250 md:ease-out md:group-hover:gap-2">
                <IconSearch className="h-[1.15rem] w-[1.15rem] shrink-0" strokeWidth="2.2" />
                <span className="max-w-0 overflow-hidden whitespace-nowrap text-sm opacity-0 transition-[max-width,opacity] duration-250 ease-out group-hover:max-w-[5rem] group-hover:opacity-100">
                  Search
                </span>
              </span>
              <IconSearch className="h-[1.15rem] w-[1.15rem] shrink-0 md:hidden" strokeWidth="2.2" />
              <span className="ml-2 md:hidden">Search</span>
            </>
          )}
        </button>
      </form>

      {showDiscoverHome ? (
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
                  onClick={() => applyFilter(item.id)}
                  aria-pressed={filter === item.id}
                  className={filter === item.id ? "btn-ghost-active" : "btn-ghost"}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 text-xs text-muted">
              <span>{totalCount} result{totalCount !== 1 ? "s" : ""}</span>
              <div ref={sortMenuRef} className="relative">
                <button
                  type="button"
                  className={isSortMenuOpen ? "btn-ghost-active min-w-[10rem] justify-between" : "btn-ghost min-w-[10rem] justify-between"}
                  aria-haspopup="listbox"
                  aria-expanded={isSortMenuOpen}
                  aria-controls="discover-sort-menu"
                  onClick={() => setIsSortMenuOpen((open) => !open)}
                >
                  <span>{RELEASE_SORT_OPTIONS.find((option) => option.value === sort)?.label ?? "Newest first"}</span>
                  <IconChevronDown className={`h-4 w-4 transition-transform ${isSortMenuOpen ? "rotate-180" : ""}`} />
                </button>

                {isSortMenuOpen ? (
                  <div
                    id="discover-sort-menu"
                    className="absolute right-0 top-full z-[var(--z-dropdown)] mt-2 w-full rounded-2xl border p-1 shadow-panel backdrop-blur-xl"
                    style={{
                      background: "var(--dropdown-bg)",
                      borderColor: "var(--edge)",
                    }}
                    role="listbox"
                    aria-label="Sort releases"
                  >
                    {RELEASE_SORT_OPTIONS.map((option) => {
                      const isSelected = option.value === sort;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                            isSelected
                              ? "bg-accent/15 text-accent-active"
                              : "text-muted hover:bg-[var(--hover-bg)] hover:text-text"
                          }`}
                          onClick={() => {
                            applySort(option.value);
                            setIsSortMenuOpen(false);
                          }}
                        >
                          <span>{option.label}</span>
                          {isSelected ? <IconCheck className="h-4 w-4" /> : <span className="h-4 w-4" aria-hidden="true" />}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {isSearchPending ? (
        <section className="panel space-y-3 px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-text">Searching for &quot;{query.trim()}&quot;</p>
              <p className="text-xs text-muted">
                Fetching fresh results from Lidarr. Uncached searches can take a moment.
              </p>
            </div>
            <span className="chip">In progress</span>
          </div>
          <div className="relative h-2 overflow-hidden rounded-full bg-[var(--overlay-bg-subtle)]">
            <div className="progress-bar progress-bar-primary absolute inset-y-0 rounded-full bg-[var(--accent-active)]" />
            <div className="progress-bar progress-bar-secondary absolute inset-y-0 rounded-full bg-[color:color-mix(in_srgb,var(--accent-active)_72%,white_28%)]" />
          </div>
        </section>
      ) : null}

      {(filter === "all" || filter === "artists") && filteredArtists.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Artists</h2>
          <div className="space-y-5">
            {filteredArtists.map((artist, artistIndex) => {
              const key = artistKey(artist);
              const image = chooseArtistImage(artist.images);
              const artistHref = buildArtistHref({
                artistName: artist.artistName,
                foreignArtistId: artist.foreignArtistId,
                from: discoverStateHref
              });
              const artistReleases = getArtistReleases(artist);
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
                      imageClassName="object-cover object-center transition-transform duration-300 hover:scale-105"
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
                          ? `${artistReleases.length} release${artistReleases.length === 1 ? "" : "s"} found${availableAlbumCount > 0 ? ` · ${availableAlbumCount} available` : ""}${trackedAlbumCount > 0 ? ` · ${trackedAlbumCount} tracked` : ""}`
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
                      {!album.hasFiles ? (
                        <button
                          type="button"
                          onClick={() => void requestAlbum(albumRequestInput, albumRequestKey)}
                          disabled={isAlbumSubmitting || album.isTracked}
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
                      ) : null}
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
                      <p className="mt-1.5 text-xs text-muted">
                        {getReleaseYearLabel(album.releaseDate)}
                      </p>
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
                      {!single.hasFiles ? (
                        <button
                          type="button"
                          onClick={() => void requestAlbum(singleRequestInput, singleRequestKey)}
                          disabled={isSingleSubmitting || single.isTracked}
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
                      ) : null}
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
                      <p className="mt-1.5 text-xs text-muted">
                        {getReleaseYearLabel(single.releaseDate)}
                      </p>
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
          <p className="text-base font-medium text-muted">No results for &quot;{submittedQuery || query}&quot;</p>
          <p className="mt-1.5 text-sm text-muted">Check the spelling or try a different artist name.</p>
          <button
            type="button"
            onClick={clearSearch}
            className="btn-ghost mt-4 mx-auto"
          >
            Clear search
          </button>
        </div>
      ) : null}

    </div>
  );
}
