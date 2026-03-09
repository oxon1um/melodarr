"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { IconCheck, IconRefresh, IconX, IconAlbum, IconUser, IconTrash } from "@/components/ui/icons";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast-provider";

type RequestItem = {
  id: string;
  requestType?: "ARTIST" | "ALBUM";
  artistName: string;
  albumTitle?: string | null;
  foreignArtistId?: string | null;
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

const timestamp = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));

export function RequestsTable({ admin = false }: Props) {
  const toast = useToast();
  const [items, setItems] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);

    const response = await fetch("/api/requests");
    const payload = (await response.json()) as {
      error?: string;
      requests?: RequestItem[];
    };

    if (!response.ok) {
      toast.error(payload.error ?? "Failed to load requests", admin ? "Manage Requests" : "My Requests");
      setLoading(false);
      return;
    }

    setItems(payload.requests ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

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

  const onDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this request? This action cannot be undone.")) {
      return;
    }

    setActing(id);

    const response = await fetch(`/api/requests/${id}`, {
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between pb-2">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {admin ? "Manage Requests" : "My Requests"}
          </h1>
          <p className="text-sm text-muted">
            {admin
              ? "Review pending requests and moderate approvals."
              : "View your request history and current statuses."}
          </p>
        </div>
        <button type="button" onClick={() => void load()} className="btn-ghost w-fit rounded-lg">
          <IconRefresh className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {!items.length ? (
        <div className="empty-state">
          <div className="mb-5 flex h-20 w-20 mx-auto items-center justify-center rounded-full border border-white/[0.08] bg-panel-2/30">
            <svg className="h-10 w-10 text-muted/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-base font-medium text-muted">No requests found</p>
          <p className="mt-1.5 text-sm text-muted/70">Start by discovering and requesting music</p>
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
                className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-panel-2/40 p-4 transition-all hover:border-white/[0.15] motion-safe:animate-fade-in-up"
                style={{ animationDelay: `${Math.min(index * 40, 280)}ms` }}
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
                    <p className="text-xs text-muted/80">
                      {admin && item.requestedBy ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-accent/60" />
                          {item.requestedBy.username}
                          <span className="mx-1 text-muted/40">·</span>
                        </span>
                      ) : null}
                      {timestamp(item.createdAt)}
                    </p>
                    {item.failureReason ? (
                      <p className="text-xs text-danger/90">{item.failureReason}</p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <StatusBadge status={item.status} />
                    {admin ? (
                      <>
                        <button
                          type="button"
                          disabled={acting === item.id}
                          onClick={() => void onDelete(item.id)}
                          className="rounded-xl border border-danger/40 bg-danger/12 px-3.5 py-2 text-xs font-medium text-danger transition-all hover:bg-danger/20 hover:border-danger/60 disabled:opacity-60"
                          title="Delete request"
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <IconTrash className="h-3.5 w-3.5" />
                            {acting === item.id ? "Working..." : "Delete"}
                          </span>
                        </button>
                        {item.status === "PENDING" && (
                          <>
                            <button
                              type="button"
                              disabled={acting === item.id}
                              onClick={() => void onModerate(item.id, "approve")}
                              className="rounded-xl border border-success/40 bg-success/12 px-3.5 py-2 text-xs font-medium text-success transition-all hover:bg-success/20 hover:border-success/60 disabled:opacity-60"
                            >
                              <span className="inline-flex items-center gap-1.5">
                                <IconCheck className="h-3.5 w-3.5" />
                                {acting === item.id ? "Working..." : "Approve"}
                              </span>
                            </button>
                            <button
                              type="button"
                              disabled={acting === item.id}
                              onClick={() => void onModerate(item.id, "reject")}
                              className="rounded-xl border border-danger/40 bg-danger/12 px-3.5 py-2 text-xs font-medium text-danger transition-all hover:bg-danger/20 hover:border-danger/60 disabled:opacity-60"
                            >
                              <span className="inline-flex items-center gap-1.5">
                                <IconX className="h-3.5 w-3.5" />
                                {acting === item.id ? "Working..." : "Reject"}
                              </span>
                            </button>
                          </>
                        )}
                      </>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </Card>
  );
}
