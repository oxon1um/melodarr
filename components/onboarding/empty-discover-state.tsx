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
      {/* Hero section */}
      <div className="mx-auto max-w-2xl text-center space-y-4">
        {/* Icon */}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-[var(--edge)] bg-panel-2/50">
          <svg aria-hidden="true" className="h-10 w-10 text-accent/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.498l1.33-.377a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.498l1.33-.377a2.25 2.25 0 001.632-2.163z" />
          </svg>
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            What music do you want?
          </h2>
          <p className="text-base text-muted leading-relaxed">
            Search for artists, albums, and singles. Your requests go straight to Lidarr for downloading.
          </p>
        </div>
      </div>

      {/* Suggested searches */}
      <div className="mt-10 space-y-4">
        <p className="text-center text-sm text-muted/70">Try searching for</p>
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

      {/* How it works */}
      <div className="mt-14 space-y-6">
        <p className="text-center text-sm text-muted/70">How it works</p>
        <div className="space-y-5">
          {[
            {
              step: "01",
              heading: "Search",
              body: "Find artists, albums, and singles from your Lidarr collection.",
              icon: (
                <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              )
            },
            {
              step: "02",
              heading: "Request",
              body: "One-click sends albums straight to your download queue.",
              icon: (
                <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              )
            },
            {
              step: "03",
              heading: "Enjoy",
              body: "Music downloads automatically and becomes available in your library.",
              icon: (
                <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )
            }
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                {item.icon}
              </div>
              <div className="flex-1 pt-1.5">
                <div className="flex items-baseline gap-3">
                  <span className="font-display text-2xl font-bold tabular-nums text-accent/60">{item.step}</span>
                  <h3 className="font-medium text-text">{item.heading}</h3>
                </div>
                <p className="mt-1 text-sm text-muted leading-relaxed">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
