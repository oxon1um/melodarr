"use client";

import Link from "next/link";

const SUGGESTED_SEARCHES = [
  { query: "Radiohead", label: "Radiohead" },
  { query: "Daft Punk", label: "Daft Punk" },
  { query: "Kendrick Lamar", label: "Kendrick Lamar" },
  { query: "Pink Floyd", label: "Pink Floyd" },
  { query: "The Weeknd", label: "The Weeknd" }
];

export function EmptyDiscoverState() {
  return (
    <div className="page-enter py-12">
      {/* Hero section — kept minimal, search bar is the hero */}
      <div className="mx-auto max-w-2xl text-center space-y-6">
        {/* Icon */}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-[var(--edge)] bg-panel-2/50">
          <svg aria-hidden="true" className="h-10 w-10 text-accent/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.498l1.33-.377a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.498l1.33-.377a2.25 2.25 0 001.632-2.163z" />
          </svg>
        </div>

        <div className="space-y-2">
          <p className="text-base text-muted leading-relaxed">
            Search for artists, albums, and singles. Your requests go straight to Lidarr.
          </p>
        </div>
      </div>

      {/* Suggested searches */}
      <div className="mt-10 space-y-4">
        <p className="text-center text-sm text-muted">Try searching for</p>
        <div className="flex flex-wrap justify-center gap-2">
          {SUGGESTED_SEARCHES.map((search) => (
            <Link
              key={search.query}
              href={`/discover?q=${encodeURIComponent(search.query)}`}
              className="rounded-xl border border-[var(--edge)] bg-panel-2/30 px-4 py-2 text-sm text-muted transition-all hover:border-accent/30 hover:bg-accent/5 hover:text-accent-active"
            >
              {search.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
