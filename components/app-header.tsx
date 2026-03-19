"use client";

import type { Route } from "next";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/ui/logout-button";

type User = {
  username: string;
  role: "ADMIN" | "USER";
};

type Props = {
  user: User | null;
};

export function AppHeader({ user }: Props) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Show header when at top
      if (currentScrollY < 80) {
        setScrolled(false);
        setHidden(false);
        lastScrollY.current = 0;
        return;
      }

      setScrolled(true);

      // Hide nav row when scrolling down past threshold
      if (currentScrollY > lastScrollY.current && currentScrollY > 160) {
        setHidden(true);
      }

      // Show nav row when scrolling up
      if (currentScrollY < lastScrollY.current - 8) {
        setHidden(false);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Active nav link helper
  const isActive = (href: string) => {
    if (href === "/discover") return pathname === "/discover" || pathname.startsWith("/discover/");
    if (href === "/requests") return pathname === "/requests";
    if (href === "/admin/requests") return pathname === "/admin/requests";
    if (href === "/admin/settings") return pathname === "/admin/settings";
    return pathname === href;
  };

  return (
    <header
      className={`sticky top-0 z-30 border-b border-white/[0.06] bg-[#03070d]/70 backdrop-blur-xl transition-all duration-300 ${
        scrolled ? "py-2" : "py-4"
      }`}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 sm:px-6 md:gap-3">
        {/* Row 1: Logo + Nav */}
        <div
          className={`flex flex-wrap items-center gap-3 transition-all duration-300 ${
            hidden ? "opacity-0 -mt-2 pointer-events-none" : "opacity-100"
          }`}
        >
          <Link
            className="font-display text-2xl font-semibold tracking-tight text-accent transition-colors hover:text-accent-hover"
            href="/discover"
          >
            Melodarr
          </Link>
          {user ? (
            <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted" aria-label="Main navigation">
              {[
                { href: "/discover", label: "Discover" },
                { href: "/requests", label: "Requests" }
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href as Route}
                  aria-current={isActive(href) ? "page" : undefined}
                  className={`rounded-lg px-3 py-1.5 transition-colors ${
                    isActive(href)
                      ? "bg-accent/10 text-accent"
                      : "btn-ghost"
                  }`}
                >
                  {label}
                </Link>
              ))}
              {user.role === "ADMIN" ? (
                <>
                  {[
                    { href: "/admin/requests", label: "Manage Requests" },
                    { href: "/admin/settings", label: "Settings" }
                  ].map(({ href, label }) => (
                    <Link
                      key={href}
                      href={href as Route}
                      aria-current={isActive(href) ? "page" : undefined}
                      className={`rounded-lg px-3 py-1.5 transition-colors ${
                        isActive(href)
                          ? "bg-accent/10 text-accent"
                          : "btn-ghost"
                      }`}
                    >
                      {label}
                    </Link>
                  ))}
                </>
              ) : null}
            </nav>
          ) : null}
        </div>

        {/* Row 2: User info — always visible once scrolled */}
        <div
          className={`flex items-center gap-3 text-sm text-muted transition-all duration-300 ${
            hidden ? "justify-end" : "justify-end md:justify-start"
          }`}
        >
          {user ? (
            <>
              <span className="rounded-xl border border-white/[0.08] bg-panel/50 px-3 py-1.5 backdrop-blur-sm">
                {user.username}
              </span>
              <LogoutButton />
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
