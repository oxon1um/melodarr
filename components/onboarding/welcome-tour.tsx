"use client";

import type { Route } from "next";
import { useEffect, useRef, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import Link from "next/link";

const TOUR_KEY = "melodarr:welcome-tour-seen";
const TOUR_STORAGE_EVENT = "melodarr:welcome-tour-change";

const subscribeToDismissedState = (onStoreChange: () => void) => {
  const handleStorageChange = (event: Event) => {
    if (event instanceof StorageEvent && event.key !== null && event.key !== TOUR_KEY) {
      return;
    }

    onStoreChange();
  };

  window.addEventListener("storage", handleStorageChange);
  window.addEventListener(TOUR_STORAGE_EVENT, handleStorageChange);

  return () => {
    window.removeEventListener("storage", handleStorageChange);
    window.removeEventListener(TOUR_STORAGE_EVENT, handleStorageChange);
  };
};

const getDismissedSnapshot = () => window.localStorage.getItem(TOUR_KEY) === "true";
const getDismissedServerSnapshot = () => true;

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
  const dismissed = useSyncExternalStore(
    subscribeToDismissedState,
    getDismissedSnapshot,
    getDismissedServerSnapshot
  );
  const dismissButtonRef = useRef<HTMLButtonElement>(null);

  // Focus the dismiss button when modal opens for keyboard users
  useEffect(() => {
    if (!dismissed && dismissButtonRef.current) {
      dismissButtonRef.current.focus();
    }
  }, [dismissed]);

  const dismiss = () => {
    window.localStorage.setItem(TOUR_KEY, "true");
    window.dispatchEvent(new Event(TOUR_STORAGE_EVENT));
  };

  if (dismissed) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop:bg-[var(--scrim)] backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-tour-title"
    >
      <div className="absolute inset-0" onClick={dismiss} aria-hidden="true" />

      <div className="panel relative w-full max-w-lg space-y-6 p-6 motion-safe:animate-fade-in-up">
        <div className="space-y-1.5">
          <h2 id="welcome-tour-title" className="font-display text-2xl font-semibold tracking-tight text-accent">
            Welcome to Melodarr
          </h2>
          <p className="text-base text-muted leading-relaxed">
            Your personal music request system. Here&apos;s how to get started.
          </p>
        </div>

        <div className="space-y-3">
          {TOUR_STEPS.map((step, index) => (
            <Link
              key={step.id}
              href={step.href as Route}
              onClick={dismiss}
              className="group flex items-start gap-4 rounded-2xl border border-[var(--edge)] bg-panel-2/40 p-4 transition-all hover:border-accent/30 hover:bg-panel-2/60"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent transition-transform group-hover:scale-105">
                {step.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted">0{index + 1}</span>
                  <h3 className="font-medium text-text group-hover:text-accent-active transition-colors">
                    {step.title}
                  </h3>
                </div>
                <p className="mt-0.5 text-base text-muted leading-relaxed">{step.description}</p>
              </div>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--edge-bright)] text-muted transition-all group-hover:border-accent/40 group-hover:text-accent group-hover:bg-accent/10">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </span>
            </Link>
          ))}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            ref={dismissButtonRef}
            onClick={dismiss}
            className="text-sm text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
          >
            Skip tour
          </button>
        </div>
      </div>
    </div>
  );
}
