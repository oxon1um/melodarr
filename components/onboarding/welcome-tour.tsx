"use client";

import type { Route } from "next";
import { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";

const TOUR_KEY = "melodarr:welcome-tour-seen";
const TOUR_STEPS: Array<{
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  cta: string;
  href: Route;
}> = [
  {
    id: "discover",
    title: "Discover Music",
    description: "Search for artists, albums, and singles from your Lidarr collection.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
    ),
    cta: "Search for music",
    href: "/discover"
  },
  {
    id: "request",
    title: "Request Albums",
    description: "Found something you want? One click sends it to your download queue.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15m0-3l-3-3m0 0l-3 3m3-3v15" />
      </svg>
    ),
    cta: "See how it works",
    href: "/discover?q=taylor+swift"
  },
  {
    id: "track",
    title: "Track Requests",
    description: "Monitor your requests from submission through download.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
      </svg>
    ),
    cta: "View your requests",
    href: "/requests"
  }
];

export function WelcomeTour() {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(TOUR_KEY) === "true";
  });

  const dismiss = () => {
    window.localStorage.setItem(TOUR_KEY, "true");
    setDismissed(true);
  };

  if (dismissed) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={dismiss} />

      {/* Modal */}
      <div className="panel relative w-full max-w-lg space-y-6 p-6 animate-fade-in-up">
        {/* Header */}
        <div className="space-y-1.5">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-accent">
            Welcome to Melodarr
          </h2>
          <p className="text-sm text-muted">
            Your personal music request system. Here&apos;s how to get started.
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {TOUR_STEPS.map((step, index) => (
            <Link
              key={step.id}
              href={step.href as Route}
              onClick={dismiss}
              className="group flex items-start gap-4 rounded-2xl border border-white/[0.08] bg-panel-2/40 p-4 transition-all hover:border-accent/30 hover:bg-panel-2/60"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent transition-transform group-hover:scale-105">
                {step.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted/60">0{index + 1}</span>
                  <h3 className="font-medium text-text group-hover:text-accent-active transition-colors">
                    {step.title}
                  </h3>
                </div>
                <p className="mt-0.5 text-sm text-muted">{step.description}</p>
              </div>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/[0.15] text-muted/50 transition-all group-hover:border-accent/40 group-hover:text-accent group-hover:bg-accent/10">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </span>
            </Link>
          ))}
        </div>

        {/* Dismiss */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={dismiss}
            className="text-sm text-muted transition-colors hover:text-text"
          >
            Skip tour
          </button>
        </div>
      </div>
    </div>
  );
}
