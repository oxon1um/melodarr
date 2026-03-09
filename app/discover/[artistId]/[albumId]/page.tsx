"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { IconAlbum, IconDownload } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast-provider";

type AlbumDetails = {
  title: string;
  foreignAlbumId?: string;
  foreignArtistId?: string;
  artistName?: string;
  releaseDate?: string;
  images?: Array<{ coverType?: string; remoteUrl?: string; url?: string }>;
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
  isExisting: boolean;
};

const chooseImage = (images?: Array<{ coverType?: string; remoteUrl?: string; url?: string }>) => {
  if (!images || images.length === 0) return undefined;

  return (
    images.find((item) => item.coverType === "cover")?.remoteUrl ??
    images.find((item) => item.coverType === "poster")?.remoteUrl ??
    images.find((item) => item.coverType === "fanart")?.remoteUrl ??
    images[0]?.remoteUrl ??
    images[0]?.url
  );
};

const formatDuration = (ms?: number) => {
  if (!ms) return "--:--";
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

export default function AlbumDetailPage() {
  const params = useParams();
  const router = useRouter();
  const artistId = params.artistId as string;
  const albumId = params.albumId as string;

  const toast = useToast();
  const [data, setData] = useState<AlbumData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!albumId) return;

    setLoading(true);

    const fetchAlbum = async () => {
      try {
        const response = await fetch(`/api/search/album/${encodeURIComponent(albumId)}`);
        const payload = await response.json();

        if (!response.ok) {
          toast.error(payload.error ?? "Failed to load album", "Album");
          return;
        }

        setData(payload as AlbumData);
      } catch {
        toast.error("Failed to load album details", "Album");
      } finally {
        setLoading(false);
      }
    };

    void fetchAlbum();
  }, [albumId, toast]);

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

  if (loading) {
    return (
      <div className="page-enter space-y-7">
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()} className="btn-ghost rounded-lg">
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
          <button onClick={() => router.back()} className="btn-ghost rounded-lg">
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

  const { album, tracks, isExisting } = data;
  const image = chooseImage(album.images);
  const artistName = album.artistName ?? album.artist?.artistName ?? "Unknown Artist";

  return (
    <div className="page-enter space-y-7">
      <div className="flex items-center gap-2">
        <button onClick={() => router.back()} className="btn-ghost rounded-lg">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
      </div>

      <section className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="h-48 w-48 shrink-0 overflow-hidden rounded-2xl border border-white/[0.1] bg-panel-2">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt={album.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted">No cover</div>
          )}
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight">{album.title}</h1>
          <p className="text-lg text-muted">
            <Link
              href={`/discover/${encodeURIComponent(album.foreignArtistId ?? artistId)}` as const}
              className="text-accent hover:underline"
            >
              {artistName}
            </Link>
          </p>
          {album.releaseDate && (
            <p className="text-sm text-muted">
              {new Date(album.releaseDate).getFullYear()}
            </p>
          )}
          {isExisting && (
            <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              In library
            </p>
          )}
          <button
            type="button"
            onClick={() => void requestAlbum()}
            disabled={submitting || isExisting}
            className="btn-primary mt-2 py-2.5"
          >
            {submitting ? (
              <>
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Requesting...
              </>
            ) : isExisting ? (
              "Already Downloaded"
            ) : (
              <>
                <IconDownload className="mr-2 h-4 w-4" />
                Download Album
              </>
            )}
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <IconAlbum className="h-5 w-5 text-accent" />
          <h2 className="text-xl font-semibold tracking-tight">Tracks</h2>
          <span className="chip">{tracks.length} tracks</span>
        </div>

        {tracks.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-white/[0.1] bg-panel-2">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.1] text-left text-sm text-muted">
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium text-right">Duration</th>
                </tr>
              </thead>
              <tbody>
                {tracks.map((track, index) => (
                  <tr
                    key={track.foreignSongId ?? index}
                    className="border-b border-white/[0.05] text-sm last:border-0 hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3 text-muted">
                      {track.trackNumber ?? index + 1}
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
