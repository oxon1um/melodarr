"use client";

import type { Route } from "next";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CoverImage } from "@/components/ui/cover-image";
import { IconAlbum, IconDownload } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast-provider";
import { pickPreferredImageUrl, type ImageAsset } from "@/lib/image-selection";

type AlbumDetails = {
  title: string;
  foreignAlbumId?: string;
  foreignArtistId?: string;
  artistName?: string;
  releaseDate?: string;
  images?: ImageAsset[];
  artist?: {
    artistName?: string;
    foreignArtistId?: string;
  };
};

type Track = {
  title: string;
  foreignSongId?: string;
  foreignAlbumId?: string;
  foreignArtistId?: string;
  duration?: number;
  trackNumber?: number;
};

type AlbumData = {
  album: AlbumDetails | null;
  tracks: Track[];
  isTracked: boolean;
  hasFiles: boolean;
};

const chooseImage = (images?: ImageAsset[]) => {
  return pickPreferredImageUrl(images, ["cover", "poster", "fanart", "banner"]);
};

const formatDuration = (ms?: number) => {
  if (!ms) return "--:--";
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

type AlbumDetailContentProps = {
  artistId: string;
  albumId: string;
};

function AlbumDetailContent({ artistId, albumId }: AlbumDetailContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const artistNameParam = searchParams.get("artistName") || undefined;
  const from = searchParams.get("from") || undefined;

  const toast = useToast();
  const [data, setData] = useState<AlbumData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Use ref to track current request for race condition handling
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!albumId) return;

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

    const fetchAlbum = async () => {
      try {
        const requestUrl = new URL(`/api/search/album/${encodeURIComponent(albumId)}`, window.location.origin);
        if (artistNameParam) {
          requestUrl.searchParams.set("artistName", artistNameParam);
        }

        const response = await fetch(requestUrl.toString(), {
          signal: abortController.signal
        });

        // Check if this is still the latest request
        if (currentRequestId !== requestIdRef.current) {
          return;
        }

        const payload = await response.json();

        if (!response.ok) {
          toast.error(payload.error ?? "Failed to load album", "Album");
          setLoading(false);
          return;
        }

        // Double-check we haven't navigated away while fetching
        if (currentRequestId !== requestIdRef.current) {
          return;
        }

        setData(payload as AlbumData);
        setLoading(false);
      } catch (error) {
        // Ignore abort errors
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        toast.error("Failed to load album details", "Album");
        setLoading(false);
      }
    };

    void fetchAlbum();

    // Cleanup: abort request on unmount or when albumId changes
    return () => {
      abortController.abort();
    };
  }, [albumId, artistNameParam, toast]);

  const requestAlbum = async () => {
    if (!data?.album) return;

    setSubmitting(true);

    const response = await fetch("/api/requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        requestType: "album",
        artistName: data.album.artistName ?? data.album.artist?.artistName ?? "",
        albumTitle: data.album.title,
        foreignArtistId: data.album.foreignArtistId ?? data.album.artist?.foreignArtistId,
        foreignAlbumId: data.album.foreignAlbumId
      })
    });

    const payload = (await response.json()) as {
      error?: string;
      duplicate?: boolean;
      request?: { status?: string };
    };

    if (!response.ok) {
      toast.error(payload.error ?? "Request failed", "Requests");
      setSubmitting(false);
      return;
    }

    if (payload.duplicate) {
      toast.info("This album has already been requested.", "Requests");
    } else {
      toast.success(`Request saved with status: ${payload.request?.status ?? "unknown"}`, "Requests");
    }

    setSubmitting(false);
  };

  const goBack = useCallback(() => {
    if (from) {
      router.push(from as Route);
      return;
    }

    router.back();
  }, [from, router]);

  if (loading) {
    return (
      <div className="page-enter space-y-7">
        <div className="flex items-center gap-2">
          <button onClick={goBack} className="btn-ghost rounded-lg">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        </div>
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!data?.album) {
    return (
      <div className="page-enter space-y-7">
        <div className="flex items-center gap-2">
          <button onClick={goBack} className="btn-ghost rounded-lg">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        </div>
        <div className="empty-state">
          <p className="text-muted">Album not found</p>
        </div>
      </div>
    );
  }

  const { album, tracks, isTracked, hasFiles } = data;
  const image = chooseImage(album.images);
  const artistName = album.artistName ?? album.artist?.artistName ?? "Unknown Artist";
  const currentArtistId = album.foreignArtistId ?? artistId;
  const artistRoutePattern = new RegExp(`^/discover/${encodeURIComponent(currentArtistId)}(?:\\?.*)?$`);
  const artistHref = artistRoutePattern.test(from ?? "")
    ? (from as Route)
    : (`/discover/${encodeURIComponent(currentArtistId)}?artistName=${encodeURIComponent(artistNameParam ?? artistName)}${from ? `&from=${encodeURIComponent(from)}` : ""}` as Route);

  return (
    <div className="page-enter space-y-7">
      <div className="flex items-center gap-2">
        <button onClick={goBack} className="btn-ghost rounded-lg">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
      </div>

      <section className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <CoverImage
          alt={album.title}
          src={image}
          sizes="(max-width: 639px) 144px, (min-width: 640px) 192px"
          priority
          className="relative h-36 w-36 sm:h-48 sm:w-48 shrink-0 overflow-hidden rounded-2xl border border-[var(--edge)] bg-panel-2"
        />
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight">{album.title}</h1>
          <p className="text-lg text-muted">
            <Link
              href={artistHref}
              className="hover:text-text"
            >
              {artistName}
            </Link>
          </p>
          {album.releaseDate && (
            <p className="text-sm text-muted">
              {new Date(album.releaseDate).getFullYear()}
            </p>
          )}
          {hasFiles && (
            <p className="inline-flex items-center gap-1.5 rounded-full badge-available-pill px-3 py-1 text-xs font-medium">
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Available
            </p>
          )}
          {isTracked && !hasFiles && (
            <p className="pill inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-muted">
              Monitored
            </p>
          )}
          {!isTracked && !hasFiles ? (
            <button
              type="button"
              onClick={() => void requestAlbum()}
              disabled={submitting}
              className="btn-request mt-2"
            >
              {submitting ? (
                <>
                  <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Requesting...
                </>
              ) : (
                <>
                  <IconDownload className="mr-2 h-4 w-4" />
                  Request Album
                </>
              )}
            </button>
          ) : null}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <IconAlbum className="h-5 w-5 text-accent" />
          <h2 className="text-xl font-semibold tracking-tight">Tracks</h2>
          <span className="chip">{tracks.length} tracks</span>
        </div>

        {tracks.length > 0 ? (
          <div className="overflow-x-auto soft-scroll rounded-xl border border-[var(--edge)] bg-panel-2">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--edge)] text-left text-sm text-muted">
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium text-right">Duration</th>
                </tr>
              </thead>
              <tbody>
                {tracks.map((track, index) => (
                  <tr
                    key={track.foreignSongId ?? index}
                    className="border-b border-[var(--edge)] text-sm last:border-0 hover:bg-[var(--hover-bg)]"
                  >
                    <td className="px-4 py-3 text-muted">
                      {(track.trackNumber ?? 0) || index + 1}
                    </td>
                    <td className="px-4 py-3 text-text">{track.title}</td>
                    <td className="px-4 py-3 text-right text-muted">
                      {formatDuration(track.duration)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p className="text-muted">No track information available</p>
          </div>
        )}
      </section>
    </div>
  );
}

export default function AlbumDetailPage() {
  const params = useParams();
  const artistId = params.artistId as string;
  const albumId = params.albumId as string;

  return <AlbumDetailContent key={albumId} artistId={artistId} albumId={albumId} />;
}
