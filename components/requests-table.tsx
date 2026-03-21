"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { IconCheck, IconRefresh, IconX, IconAlbum, IconUser, IconTrash } from "@/components/ui/icons";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type RequestItem = {
  id: string;
  requestType?: "ARTIST" | "ALBUM";
  artistName: string;
  albumTitle?: string | null;
  foreignArtistId?: string | null;
  lidarrArtistId?: number | null;
  lidarrAlbumId?: number | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "SUBMITTED" | "FAILED" | "ALREADY_EXISTS";
  failureReason?: string | null;
  createdAt: string;
  requestedBy?: {
    username: string;
  };
};

type Props = {
  admin?: boolean;
};

type RequestsPayload = {
  error?: string;
  requests?: RequestItem[];
  nextCursor?: string | null;
  hasMore?: boolean;
};

const timestamp = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));

export function RequestsTable({ admin = false }: Props) {
  const toast = useToast();
  const [items, setItems] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadPage = useCallback(async (cursor?: string | null): Promise<RequestsPayload | null> => {
    const params = new URLSearchParams({ limit: "25" });
    if (cursor) {
      params.set("cursor", cursor);
    }

    const response = await fetch(`/api/requests?${params.toString()}`);
    const payload = (await response.json()) as RequestsPayload;

    if (!response.ok) {
      toast.error(payload.error ?? "Failed to load requests", admin ? "Manage Requests" : "My Requests");
      return null;
    }

    return payload;
  }, [admin, toast]);

  const load = useCallback(async () => {
    setLoading(true);
    const payload = await loadPage();
    if (!payload) {
      setLoading(false);
      return;
    }

    setItems(payload.requests ?? []);
    setNextCursor(payload.nextCursor ?? null);
    setHasMore(payload.hasMore ?? false);
    setLoading(false);
  }, [loadPage]);

  const loadMore = async () => {
    if (!hasMore || !nextCursor) {
      return;
    }

    setLoadingMore(true);
    const payload = await loadPage(nextCursor);
    if (!payload) {
      setLoadingMore(false);
      return;
    }

    setItems((current) => [...current, ...(payload.requests ?? [])]);
    setNextCursor(payload.nextCursor ?? null);
    setHasMore(payload.hasMore ?? false);
    setLoadingMore(false);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  const onModerate = async (id: string, action: "approve" | "reject") => {
    setActing(id);

    const response = await fetch(`/api/requests/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ action })
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      toast.error(payload.error ?? "Failed to update request", "Requests");
      setActing(null);
      return;
    }

    setActing(null);
    toast.success(action === "approve" ? "Request approved." : "Request rejected.", "Requests");
    await load();
  };

  const onDelete = async () => {
    if (!deleteId) return;

    setActing(deleteId);
    setDeleteId(null);

    const response = await fetch(`/api/requests/${deleteId}`, {
      method: "DELETE"
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      toast.error(payload.error ?? "Failed to delete request", "Requests");
      setActing(null);
      return;
    }

    setActing(null);
    toast.success("Request deleted.", "Requests");
    await load();
  };

  if (loading) {
    return (
      <Card className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <div className="skeleton-shimmer h-8 w-48 rounded-lg" />
            <div className="skeleton-shimmer h-4 w-72 rounded-lg" />
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton-shimmer h-24 w-full rounded-2xl" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {admin ? "Manage Requests" : "My Requests"}
          </h1>
          <p className="text-sm text-muted">
            {admin
              ? "Review pending requests and approve or reject them."
              : "See your requests and their current status."}
          </p>
        </div>
        <button type="button" onClick={() => void load()} className="btn-ghost w-fit rounded-lg">
          <IconRefresh className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {!items.length ? (
        <div className="empty-state">
          <div className="mb-5 flex h-20 w-20 mx-auto items-center justify-center rounded-full border border-[var(--edge)] bg-panel-2/30">
            <svg aria-hidden="true" className="h-10 w-10 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-base font-medium text-muted">No requests yet</p>
          <p className="mt-1.5 text-sm text-muted">Find music you want and request it here.</p>
          <Link href="/discover" className="btn-primary mt-4 inline-flex">
            Browse Music
          </Link>
        </div>
      ) : (
        <div className="soft-scroll max-h-[68vh] space-y-3 overflow-auto pr-1">
          {items.map((item, index) => {
            const label =
              item.requestType === "ALBUM" && item.albumTitle
                ? `${item.artistName} • ${item.albumTitle}`
                : item.artistName;
            return (
              <article
                key={item.id}
                className="group relative overflow-hidden rounded-2xl border border-[var(--edge)] bg-panel-2/40 p-4 transition-all hover:border-[var(--edge-bright)] motion-safe:animate-fade-in-up"
                style={{ animationDelay: `${Math.min(index * 50, 280)}ms` }}
              >
                {/* Subtle shine */}
                <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent" />
                </div>

                <div className="relative flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-base font-medium text-text">{label}</p>
                      <span className="inline-flex items-center gap-1.5 chip">
                        {item.requestType === "ALBUM" ? (
                          <IconAlbum className="h-3 w-3" />
                        ) : (
                          <IconUser className="h-3 w-3" />
                        )}
                        {item.requestType === "ALBUM" ? "Album" : "Artist"}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted">
                      {admin && item.requestedBy ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-accent/60" />
                          <span className="truncate">{item.requestedBy.username}</span>
                          <span className="mx-1 text-muted">·</span>
                        </span>
                      ) : null}
                      {timestamp(item.createdAt)}
                    </p>
                    {item.failureReason ? (
                      <p className="text-xs text-danger">{item.failureReason}</p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={item.status} />
                    {admin ? (
                      <>
                        {item.status === "PENDING" && (
                          <button
                            type="button"
                            disabled={acting === item.id}
                            onClick={() => void onModerate(item.id, "approve")}
                            className="btn-approve"
                          >
                            <span className="inline-flex items-center gap-1.5">
                              <IconCheck className="h-4 w-4" />
                              {acting === item.id ? "Working..." : "Approve"}
                            </span>
                          </button>
                        )}
                        {item.status === "PENDING" && (
                          <button
                            type="button"
                            disabled={acting === item.id}
                            onClick={() => void onModerate(item.id, "reject")}
                            className="icon-btn"
                            title="Reject"
                            aria-label="Reject"
                          >
                            <IconX className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={acting === item.id}
                          onClick={() => setDeleteId(item.id)}
                          className="icon-btn-danger"
                          title="Delete request"
                          aria-label="Delete request"
                        >
                          <IconTrash className="h-4 w-4" />
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
          {hasMore ? (
            <div className="flex justify-center pt-3">
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="btn-ghost rounded-lg"
              >
                {loadingMore ? "Loading..." : "Load More"}
              </button>
            </div>
          ) : null}
        </div>
      )}
      <ConfirmDialog
        open={deleteId !== null}
        title="Delete Request"
        message="Are you sure you want to delete this request? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={onDelete}
        onCancel={() => setDeleteId(null)}
      />
    </Card>
  );
}
