"use client";

import type { Route } from "next";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { CoverImage } from "@/components/ui/cover-image";
import { IconAlbum, IconChevronDown, IconCheck, IconDownload, IconGrid, IconList } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast-provider";
import {
  filterNoisySingles,
  RELEASE_SORT_OPTIONS,
  type ReleaseSort,
  sortReleases
} from "@/lib/discover/release-browser";
import { pickPreferredImageUrl, type ImageAsset } from "@/lib/image-selection";
import { useProgressiveCount } from "@/lib/use-progressive-count";

type ArtistDetails = {
  artistName: string;
  foreignArtistId?: string;
  overview?: string;
  images?: ImageAsset[];
};

type AlbumWithStatus = {
  title: string;
  foreignAlbumId?: string;
  foreignArtistId?: string;
  artistName?: string;
  releaseDate?: string;
  secondaryTypes?: string[];
  releaseStatuses?: string[];
  images?: ImageAsset[];
  isTracked: boolean;
  hasFiles: boolean;
};

type ArtistData = {
  artist: ArtistDetails | null;
  albums: AlbumWithStatus[];
  singles: AlbumWithStatus[];
  trackedCount: number;
  availableCount: number;
};

type ViewMode = "grid" | "list";

const getReleaseSortFromParam = (sortParam: string | null): ReleaseSort =>
  RELEASE_SORT_OPTIONS.some((option) => option.value === sortParam)
    ? (sortParam as ReleaseSort)
    : DEFAULT_RELEASE_SORT;

const getViewModeFromParam = (viewParam: string | null): ViewMode =>
  viewParam === "list" ? "list" : "grid";

const chooseImage = (images?: ImageAsset[]) => {
  return pickPreferredImageUrl(images, ["cover", "poster", "fanart", "banner"]);
};

const albumKey = (album: { foreignAlbumId?: string; title: string }) =>
  album.foreignAlbumId ?? album.title;

const DEFAULT_RELEASE_SORT: ReleaseSort = "newest";

type ArtistDetailContentProps = {
  artistId: string;
};

function ArtistDetailContent({ artistId }: ArtistDetailContentProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const artistName = searchParams.get("artistName") || undefined;
  const from = searchParams.get("from") || "/discover";
  const sortParam = searchParams.get("sort");
  const viewParam = searchParams.get("view");

  const toast = useToast();
  const [data, setData] = useState<ArtistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [sort, setSort] = useState<ReleaseSort>(getReleaseSortFromParam(sortParam));
  const [viewMode, setViewMode] = useState<ViewMode>(getViewModeFromParam(viewParam));
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const artist = data?.artist ?? null;
  const albums = data?.albums ?? [];
  const singles = data?.singles ?? [];
  const displayedAlbums = sortReleases(albums, sort);
  const displayedSingles = filterNoisySingles(sortReleases(singles, sort));
  const displayedReleases = [...displayedAlbums, ...displayedSingles];
  const trackedCount = displayedReleases.filter((album) => album.isTracked).length;
  const availableCount = displayedReleases.filter((album) => album.hasFiles).length;
  const {
    visibleCount: visibleAlbumCount,
    sentinelRef: albumSentinelRef,
    hasMore: hasMoreAlbums
  } = useProgressiveCount(displayedAlbums.length, [artistId, sort, displayedAlbums.length]);
  const {
    visibleCount: visibleSingleCount,
    sentinelRef: singleSentinelRef,
    hasMore: hasMoreSingles
  } = useProgressiveCount(displayedSingles.length, [artistId, sort, displayedSingles.length]);
  const visibleAlbums = useMemo(
    () => displayedAlbums.slice(0, visibleAlbumCount),
    [displayedAlbums, visibleAlbumCount]
  );
  const visibleSingles = useMemo(
    () => displayedSingles.slice(0, visibleSingleCount),
    [displayedSingles, visibleSingleCount]
  );

  // Use ref to track current request for race condition handling
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!artistId) return;

    // Increment request ID for this navigation
    requestIdRef.current++;
    const currentRequestId = requestIdRef.current;

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const fetchArtist = async () => {
      try {
        // Build URL with query params
        const url = new URL(`/api/search/artist/${encodeURIComponent(artistId)}`, window.location.origin);
        if (artistName) {
          url.searchParams.set("artistName", artistName);
        }
        const response = await fetch(url.toString(), {
          signal: abortController.signal
        });

        // Check if this is still the latest request
        if (currentRequestId !== requestIdRef.current) {
          return;
        }

        const payload = await response.json();

        if (!response.ok) {
          toast.error(payload.error ?? "Failed to load artist", "Artist");
          setLoading(false);
          return;
        }

        // Double-check we haven't navigated away while fetching
        if (currentRequestId !== requestIdRef.current) {
          return;
        }

        setData(payload as ArtistData);
        setLoading(false);
      } catch (error) {
        // Ignore abort errors
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        toast.error("Failed to load artist details", "Artist");
        setLoading(false);
      }
    };

    void fetchArtist();

    // Cleanup: abort request on unmount or when artistId changes
    return () => {
      abortController.abort();
    };
  }, [artistId, artistName, toast]);

  useEffect(() => {
    const syncStateFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const nextSort = getReleaseSortFromParam(params.get("sort"));
      const nextViewMode = getViewModeFromParam(params.get("view"));

      setSort((currentSort) => (currentSort === nextSort ? currentSort : nextSort));
      setViewMode((currentViewMode) =>
        currentViewMode === nextViewMode ? currentViewMode : nextViewMode
      );
    };

    window.addEventListener("popstate", syncStateFromUrl);

    return () => {
      window.removeEventListener("popstate", syncStateFromUrl);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (artistName) {
      params.set("artistName", artistName);
    }
    if (from) {
      params.set("from", from);
    }
    if (sort === DEFAULT_RELEASE_SORT) {
      params.delete("sort");
    } else {
      params.set("sort", sort);
    }
    if (viewMode === "grid") {
      params.delete("view");
    } else {
      params.set("view", viewMode);
    }

    const nextHref = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    window.history.replaceState(null, "", nextHref);
  }, [artistName, from, pathname, sort, viewMode]);

  useEffect(() => {
    if (!isSortMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!sortMenuRef.current?.contains(event.target as Node)) {
        setIsSortMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSortMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSortMenuOpen]);

  const selectedSortOption =
    RELEASE_SORT_OPTIONS.find((option) => option.value === sort) ?? RELEASE_SORT_OPTIONS[0];

  const requestAlbum = async (
    album: { title: string; artistName?: string; foreignArtistId?: string; foreignAlbumId?: string },
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
        artistName: album.artistName ?? data?.artist?.artistName ?? "",
        albumTitle: album.title,
        foreignArtistId: album.foreignArtistId,
        foreignAlbumId: album.foreignAlbumId
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

  if (loading) {
    return (
      <div className="page-enter space-y-7">
        <div className="flex items-center gap-2">
          <a href={from} className="btn-ghost rounded-lg">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </a>
        </div>
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="page-enter space-y-7">
        <div className="flex items-center gap-2">
          <a href={from} className="btn-ghost rounded-lg">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </a>
        </div>
        <div className="empty-state">
          <p className="text-muted">Artist not found</p>
        </div>
      </div>
    );
  }

  const image = chooseImage(artist.images);
  const artistParams = new URLSearchParams();
  artistParams.set("artistName", artist.artistName);
  if (from) {
    artistParams.set("from", from);
  }
  if (sort !== DEFAULT_RELEASE_SORT) {
    artistParams.set("sort", sort);
  }
  if (viewMode !== "grid") {
    artistParams.set("view", viewMode);
  }
  const artistHref = (`/discover/${encodeURIComponent(artist.foreignArtistId ?? artistId)}?${artistParams.toString()}`) as Route;
  const releaseGridClassName =
    viewMode === "grid"
      ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
      : "space-y-4";

  return (
    <div className="page-enter space-y-7">
      <div className="flex items-center gap-2">
        <a href={from} className="btn-ghost rounded-lg">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </a>
      </div>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] xl:items-start">
        <CoverImage
          alt={artist.artistName}
          src={image}
          sizes="(max-width: 639px) 128px, (min-width: 640px) 160px"
          priority
          className="relative h-32 w-32 sm:h-40 sm:w-40 shrink-0 overflow-hidden rounded-2xl border border-[var(--edge)] bg-panel-2"
          imageClassName="object-cover object-center"
        />
        <div className="max-w-3xl space-y-3">
          <h1 className="font-display text-3xl font-semibold tracking-tight">{artist.artistName}</h1>
          {availableCount > 0 && (
            <p className="inline-flex items-center gap-1.5 text-sm text-muted">
              <svg className="h-3.5 w-3.5 text-success shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              {availableCount} release{availableCount === 1 ? "" : "s"} available
            </p>
          )}
          {trackedCount > availableCount && (
            <p className="text-xs text-muted">
              {trackedCount} monitored
            </p>
          )}
          <p className="max-w-2xl text-sm leading-relaxed text-muted xl:max-w-[42rem]">
            {artist.overview ?? "No description available."}
          </p>
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3">
        <div ref={sortMenuRef} className="relative">
          <button
            type="button"
            className={isSortMenuOpen ? "btn-ghost-active min-w-[10rem] justify-between" : "btn-ghost min-w-[10rem] justify-between"}
            aria-haspopup="listbox"
            aria-expanded={isSortMenuOpen}
            aria-controls="artist-sort-menu"
            onClick={() => setIsSortMenuOpen((open) => !open)}
          >
            <span>{selectedSortOption.label}</span>
            <IconChevronDown className={`h-4 w-4 transition-transform ${isSortMenuOpen ? "rotate-180" : ""}`} />
          </button>

          {isSortMenuOpen ? (
            <div
              id="artist-sort-menu"
              className="absolute left-0 top-full z-[var(--z-dropdown)] mt-2 w-full rounded-2xl border p-1 shadow-panel backdrop-blur-xl"
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
                      setSort(option.value);
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

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            aria-pressed={viewMode === "grid"}
            className={viewMode === "grid" ? "btn-ghost-active" : "btn-ghost"}
          >
            <IconGrid className="h-4 w-4" />
            Icons
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            aria-pressed={viewMode === "list"}
            className={viewMode === "list" ? "btn-ghost-active" : "btn-ghost"}
          >
            <IconList className="h-4 w-4" />
            List
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <IconAlbum className="h-5 w-5 text-accent" />
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted">Albums</h2>
          <span className="chip">{displayedAlbums.length} found</span>
        </div>

        {displayedAlbums.length > 0 ? (
          <>
            <div className={releaseGridClassName}>
              {visibleAlbums.map((album, index) => {
                const key = albumKey(album);
                const cover = chooseImage(album.images);
                const albumDetailHref = `/discover/${encodeURIComponent(artist.foreignArtistId ?? artistId)}/${encodeURIComponent(album.foreignAlbumId ?? key)}?artistName=${encodeURIComponent(artist.artistName)}&from=${encodeURIComponent(artistHref)}` as const;

                return (
                  <Card
                    key={`album:${key}`}
                    className={`group motion-safe:animate-fade-in-up ${viewMode === "list" ? "p-4" : ""}`}
                    style={{ animationDelay: `${Math.min(index * 50, 280)}ms` }}
                  >
                    <div className={viewMode === "list" ? "flex gap-4" : "block"}>
                      <Link href={albumDetailHref} className={viewMode === "list" ? "block w-28 shrink-0 sm:w-32" : "block"}>
                        <div className="relative overflow-hidden rounded-xl border border-[var(--edge)] bg-panel-2">
                          <CoverImage
                            alt={album.title}
                            src={cover}
                            sizes="(min-width: 1280px) 16rem, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                            className="relative aspect-square"
                            imageClassName="object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          {album.hasFiles && (
                            <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full badge-available px-2 py-1 text-[10px] font-medium shadow-lg">
                              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              Available
                            </div>
                          )}
                          {!album.hasFiles && album.isTracked && (
                            <div className="absolute left-2 top-2 rounded-full badge-tracked px-2 py-1 text-[10px] font-medium shadow-lg">
                              Tracked
                            </div>
                          )}
                        </div>
                      </Link>
                      <div className={viewMode === "list" ? "flex min-w-0 flex-1 flex-col justify-between" : ""}>
                        <div className={viewMode === "list" ? "min-w-0" : "mt-3 space-y-1"}>
                          <p className="truncate text-sm font-medium text-text">{album.title}</p>
                          {album.releaseDate && (
                            <p className="text-xs text-muted">{new Date(album.releaseDate).getFullYear()}</p>
                          )}
                        </div>
                        <div className={`flex items-center ${viewMode === "list" ? "mt-4" : "mt-3"}`}>
                          {!album.hasFiles ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                void requestAlbum(
                                  {
                                    title: album.title,
                                    artistName: album.artistName ?? artist.artistName,
                                    foreignArtistId: album.foreignArtistId,
                                    foreignAlbumId: album.foreignAlbumId
                                  },
                                  `album:${key}`
                                );
                              }}
                              disabled={submitting === `album:${key}` || album.isTracked}
                              className="quick-icon"
                              aria-label={`Request ${album.title}`}
                              title={album.isTracked ? "Already monitored" : "Request album"}
                            >
                              {submitting === `album:${key}` ? (
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                              ) : (
                                <IconDownload className="h-4 w-4" />
                              )}
                              <span className="sr-only">Quick download album</span>
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
            {hasMoreAlbums ? (
              <div ref={albumSentinelRef} className="flex justify-center pt-2 text-xs text-muted">
                Loading more albums...
              </div>
            ) : null}
          </>
        ) : (
          <div className="empty-state">
            <p className="text-muted">No albums found for this artist</p>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <IconAlbum className="h-5 w-5 text-accent" />
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted">Singles</h2>
          <span className="chip">{displayedSingles.length} found</span>
        </div>

        {displayedSingles.length > 0 ? (
          <>
            <div className={releaseGridClassName}>
              {visibleSingles.map((single, index) => {
                const key = albumKey(single);
                const cover = chooseImage(single.images);
                const singleDetailHref = `/discover/${encodeURIComponent(artist.foreignArtistId ?? artistId)}/${encodeURIComponent(single.foreignAlbumId ?? key)}?artistName=${encodeURIComponent(artist.artistName)}&from=${encodeURIComponent(artistHref)}` as const;

                return (
                  <Card
                    key={`single:${key}`}
                    className={`group motion-safe:animate-fade-in-up ${viewMode === "list" ? "p-4" : ""}`}
                    style={{ animationDelay: `${Math.min(index * 50, 280)}ms` }}
                  >
                    <div className={viewMode === "list" ? "flex gap-4" : "block"}>
                      <Link href={singleDetailHref} className={viewMode === "list" ? "block w-28 shrink-0 sm:w-32" : "block"}>
                        <div className="relative overflow-hidden rounded-xl border border-[var(--edge)] bg-panel-2">
                          <CoverImage
                            alt={single.title}
                            src={cover}
                            sizes="(min-width: 1280px) 16rem, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                            className="relative aspect-square"
                            imageClassName="object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          {single.hasFiles && (
                            <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full badge-available px-2 py-1 text-[10px] font-medium shadow-lg">
                              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              Available
                            </div>
                          )}
                          {!single.hasFiles && single.isTracked && (
                            <div className="absolute left-2 top-2 rounded-full badge-tracked px-2 py-1 text-[10px] font-medium shadow-lg">
                              Tracked
                            </div>
                          )}
                        </div>
                      </Link>
                      <div className={viewMode === "list" ? "flex min-w-0 flex-1 flex-col justify-between" : ""}>
                        <div className={viewMode === "list" ? "min-w-0" : "mt-3 space-y-1"}>
                          <p className="truncate text-sm font-medium text-text">{single.title}</p>
                          {single.releaseDate && (
                            <p className="text-xs text-muted">{new Date(single.releaseDate).getFullYear()}</p>
                          )}
                        </div>
                        <div className={`flex items-center ${viewMode === "list" ? "mt-4" : "mt-3"}`}>
                          {!single.hasFiles ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                void requestAlbum(
                                  {
                                    title: single.title,
                                    artistName: single.artistName ?? artist.artistName,
                                    foreignArtistId: single.foreignArtistId,
                                    foreignAlbumId: single.foreignAlbumId
                                  },
                                  `single:${key}`
                                );
                              }}
                              disabled={submitting === `single:${key}` || single.isTracked}
                              className="quick-icon"
                              aria-label={`Request ${single.title}`}
                              title={single.isTracked ? "Already monitored" : "Request single"}
                            >
                              {submitting === `single:${key}` ? (
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                              ) : (
                                <IconDownload className="h-4 w-4" />
                              )}
                              <span className="sr-only">Quick download single</span>
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
            {hasMoreSingles ? (
              <div ref={singleSentinelRef} className="flex justify-center pt-2 text-xs text-muted">
                Loading more singles...
              </div>
            ) : null}
          </>
        ) : (
          <div className="empty-state">
            <p className="text-muted">No singles found for this artist</p>
          </div>
        )}
      </section>
    </div>
  );
}

export default function ArtistDetailPage() {
  const params = useParams();
  const artistId = params.artistId as string;

  return <ArtistDetailContent key={artistId} artistId={artistId} />;
}
