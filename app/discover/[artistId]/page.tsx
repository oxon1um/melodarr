"use client";

import type { Route } from "next";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { CoverImage } from "@/components/ui/cover-image";
import { IconAlbum, IconDownload } from "@/components/ui/icons";
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

const chooseImage = (images?: ImageAsset[]) => {
  return pickPreferredImageUrl(images, ["poster", "cover", "fanart", "banner"]);
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

  const toast = useToast();
  const [data, setData] = useState<ArtistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [sort, setSort] = useState<ReleaseSort>(
    RELEASE_SORT_OPTIONS.some((option) => option.value === sortParam)
      ? (sortParam as ReleaseSort)
      : DEFAULT_RELEASE_SORT
  );
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
    const params = new URLSearchParams(searchParams.toString());
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

    const nextHref = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    window.history.replaceState(null, "", nextHref);
  }, [artistName, from, pathname, searchParams, sort]);

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
  const artistHref = (`/discover/${encodeURIComponent(artist.foreignArtistId ?? artistId)}?${artistParams.toString()}`) as Route;

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

      <section className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <CoverImage
          alt={artist.artistName}
          src={image}
          sizes="(max-width: 639px) 128px, (min-width: 640px) 160px"
          priority
          className="relative h-32 w-32 sm:h-40 sm:w-40 shrink-0 overflow-hidden rounded-2xl border border-[var(--edge)] bg-panel-2"
        />
        <div className="space-y-2">
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
          <p className="max-w-2xl text-sm text-muted">
            {artist.overview ?? "No description available."}
          </p>
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-3">
        <label htmlFor="artist-sort-select" className="flex items-center gap-2 text-sm text-muted">
          <span className="sr-only">Sort by</span>
          <select
            id="artist-sort-select"
            value={sort}
            onChange={(event) => setSort(event.target.value as ReleaseSort)}
            className="field-select rounded-lg border border-[var(--edge)] bg-panel px-1.5 py-0.5 text-xs"
          >
            {RELEASE_SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value} style={{ background: "var(--panel)", color: "var(--text)" }}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <IconAlbum className="h-5 w-5 text-accent" />
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted">Albums</h2>
          <span className="chip">{displayedAlbums.length} found</span>
        </div>

        {displayedAlbums.length > 0 ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibleAlbums.map((album, index) => {
                const key = albumKey(album);
                const cover = chooseImage(album.images);

                return (
                  <Card
                    key={`album:${key}`}
                    className="group motion-safe:animate-fade-in-up"
                    style={{ animationDelay: `${Math.min(index * 50, 280)}ms` }}
                  >
                    <Link
                      href={`/discover/${encodeURIComponent(artist.foreignArtistId ?? artistId)}/${encodeURIComponent(album.foreignAlbumId ?? key)}?artistName=${encodeURIComponent(artist.artistName)}&from=${encodeURIComponent(artistHref)}` as const}
                      className="block"
                    >
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
                    <div className="mt-3 space-y-1">
                      <p className="truncate text-sm font-medium text-text">{album.title}</p>
                      {album.releaseDate && (
                        <p className="text-xs text-muted">
                          {new Date(album.releaseDate).getFullYear()}
                        </p>
                      )}
                    </div>
                    </Link>
                    <div className="mt-3 flex items-center gap-2">
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
                        disabled={submitting === `album:${key}` || album.hasFiles || album.isTracked}
                        className="quick-icon"
                        aria-label={`Request ${album.title}`}
                        title={album.hasFiles ? "Already available" : album.isTracked ? "Already monitored" : "Request album"}
                      >
                        {submitting === `album:${key}` ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <IconDownload className="h-4 w-4" />
                        )}
                        <span className="sr-only">Quick download album</span>
                      </button>
                      <Link
                        href={`/discover/${encodeURIComponent(artist.foreignArtistId ?? artistId)}/${encodeURIComponent(album.foreignAlbumId ?? key)}?artistName=${encodeURIComponent(artist.artistName)}&from=${encodeURIComponent(artistHref)}` as const}
                        className={`flex-1 py-2 text-sm text-center rounded-xl font-medium transition-all ${album.hasFiles ? "btn-ghost" : "btn-primary"}`}
                      >
                        {submitting === `album:${key}`
                          ? "Requesting..."
                          : album.hasFiles
                            ? "View Album"
                            : album.isTracked
                              ? "Monitored"
                            : "Request Album"}
                      </Link>
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibleSingles.map((single, index) => {
                const key = albumKey(single);
                const cover = chooseImage(single.images);

                return (
                  <Card
                    key={`single:${key}`}
                    className="group motion-safe:animate-fade-in-up"
                    style={{ animationDelay: `${Math.min(index * 50, 280)}ms` }}
                  >
                    <Link
                      href={`/discover/${encodeURIComponent(artist.foreignArtistId ?? artistId)}/${encodeURIComponent(single.foreignAlbumId ?? key)}?artistName=${encodeURIComponent(artist.artistName)}&from=${encodeURIComponent(artistHref)}` as const}
                      className="block"
                    >
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
                      <div className="mt-3 space-y-1">
                        <p className="truncate text-sm font-medium text-text">{single.title}</p>
                        {single.releaseDate && (
                          <p className="text-xs text-muted">
                            {new Date(single.releaseDate).getFullYear()}
                          </p>
                        )}
                      </div>
                    </Link>
                    <div className="mt-3 flex items-center gap-2">
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
                        disabled={submitting === `single:${key}` || single.hasFiles || single.isTracked}
                        className="quick-icon"
                        aria-label={`Request ${single.title}`}
                        title={single.hasFiles ? "Already available" : single.isTracked ? "Already monitored" : "Request single"}
                      >
                        {submitting === `single:${key}` ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <IconDownload className="h-4 w-4" />
                        )}
                        <span className="sr-only">Quick download single</span>
                      </button>
                      <Link
                        href={`/discover/${encodeURIComponent(artist.foreignArtistId ?? artistId)}/${encodeURIComponent(single.foreignAlbumId ?? key)}?artistName=${encodeURIComponent(artist.artistName)}&from=${encodeURIComponent(artistHref)}` as const}
                        className={`flex-1 py-2 text-sm text-center rounded-xl font-medium transition-all ${single.hasFiles ? "btn-ghost" : "btn-primary"}`}
                      >
                        {submitting === `single:${key}`
                          ? "Requesting..."
                          : single.hasFiles
                            ? "View Single"
                            : single.isTracked
                              ? "Monitored"
                              : "Request Single"}
                      </Link>
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
