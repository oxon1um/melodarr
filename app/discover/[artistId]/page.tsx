"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { IconAlbum, IconDownload } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast-provider";

type ArtistDetails = {
  artistName: string;
  foreignArtistId?: string;
  overview?: string;
  images?: Array<{ coverType?: string; remoteUrl?: string; url?: string }>;
};

type AlbumWithStatus = {
  title: string;
  foreignAlbumId?: string;
  foreignArtistId?: string;
  artistName?: string;
  releaseDate?: string;
  images?: Array<{ coverType?: string; remoteUrl?: string; url?: string }>;
  isExisting: boolean;
};

type ArtistData = {
  artist: ArtistDetails | null;
  albums: AlbumWithStatus[];
  existingCount: number;
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

const albumKey = (album: { foreignAlbumId?: string; title: string }) =>
  album.foreignAlbumId ?? album.title;

export default function ArtistDetailPage() {
  const params = useParams();
  const artistId = params.artistId as string;

  const toast = useToast();
  const [data, setData] = useState<ArtistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);

  // Use ref to track current request for race condition handling
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentArtistIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!artistId) return;

    // Track the current artistId we're fetching for
    currentArtistIdRef.current = artistId;

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Reset state when artistId changes
    setData(null);
    setLoading(true);

    const fetchArtist = async () => {
      const fetchArtistId = currentArtistIdRef.current;

      try {
        const response = await fetch(`/api/search/artist/${encodeURIComponent(fetchArtistId!)}`, {
          signal: abortController.signal
        });

        // Check if this is still the current artist we're looking for
        if (fetchArtistId !== currentArtistIdRef.current) {
          return;
        }

        const payload = await response.json();

        if (!response.ok) {
          toast.error(payload.error ?? "Failed to load artist", "Artist");
          return;
        }

        // Double-check we haven't navigated away while fetching
        if (fetchArtistId !== currentArtistIdRef.current) {
          return;
        }

        setData(payload as ArtistData);
      } catch (error) {
        // Ignore abort errors
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        toast.error("Failed to load artist details", "Artist");
      } finally {
        if (fetchArtistId === currentArtistIdRef.current) {
          setLoading(false);
        }
      }
    };

    void fetchArtist();

    // Cleanup: abort request on unmount or when artistId changes
    return () => {
      abortController.abort();
    };
  }, [artistId, toast]);

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
          <a href="/discover" className="btn-ghost rounded-lg">
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

  if (!data?.artist) {
    return (
      <div className="page-enter space-y-7">
        <div className="flex items-center gap-2">
          <a href="/discover" className="btn-ghost rounded-lg">
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

  const { artist, albums, existingCount } = data;
  const image = chooseImage(artist.images);

  return (
    <div className="page-enter space-y-7">
      <div className="flex items-center gap-2">
        <a href="/discover" className="btn-ghost rounded-lg">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </a>
      </div>

      <section className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="h-40 w-40 shrink-0 overflow-hidden rounded-2xl border border-white/[0.1] bg-panel-2">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt={artist.artistName} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted">No cover</div>
          )}
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight">{artist.artistName}</h1>
          {existingCount > 0 && (
            <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              {existingCount} album{existingCount === 1 ? "" : "s"} in library
            </p>
          )}
          <p className="max-w-2xl text-sm text-muted">
            {artist.overview ?? "No description available."}
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <IconAlbum className="h-5 w-5 text-accent" />
          <h2 className="text-xl font-semibold tracking-tight">Albums</h2>
          <span className="chip">{albums.length} found</span>
        </div>

        {albums.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {albums.map((album, index) => {
              const key = albumKey(album);
              const cover = chooseImage(album.images);

              return (
                <Card
                  key={`album:${key}`}
                  className="group motion-safe:animate-fade-in-up"
                  style={{ animationDelay: `${Math.min(index * 40, 200)}ms` }}
                >
                  <Link
                    href={`/discover/${encodeURIComponent(artist.foreignArtistId ?? artistId)}/${encodeURIComponent(album.foreignAlbumId ?? key)}` as const}
                    className="block"
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
                      <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-1 text-[10px] font-medium text-white shadow-lg">
                        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        In Library
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        void requestAlbum(
                          {
                            title: album.title,
                            artistName: album.artistName ?? artist.artistName,
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
                  <div className="mt-3 space-y-1">
                    <p className="truncate text-sm font-medium text-text">{album.title}</p>
                    {album.releaseDate && (
                      <p className="text-xs text-muted/70">
                        {new Date(album.releaseDate).getFullYear()}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void requestAlbum(
                        {
                          title: album.title,
                          artistName: album.artistName ?? artist.artistName,
                          foreignArtistId: album.foreignArtistId,
                          foreignAlbumId: album.foreignAlbumId
                        },
                        `album:${key}`
                      )
                    }
                    disabled={submitting === `album:${key}` || album.isExisting}
                    className="btn-primary mt-3 w-full py-2 text-sm"
                  >
                    {album.isExisting
                      ? "Already Downloaded"
                      : submitting === `album:${key}`
                        ? "Requesting..."
                        : "Download Album"}
                  </button>
                  </Link>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <p className="text-muted">No albums found for this artist</p>
          </div>
        )}
      </section>
    </div>
  );
}
