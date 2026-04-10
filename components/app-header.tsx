"use client";

import type { Route } from "next";
import { useEffect, useState } from "react";
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

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY >= 80);
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
      className={`sticky top-0 z-30 border-b border-[var(--edge)] bg-[var(--header-bg)] backdrop-blur-xl transition-all duration-300 ${
        scrolled ? "py-2" : "py-4"
      }`}
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 sm:px-6">
        <Link
          className="font-display text-2xl font-semibold tracking-tight text-accent transition-colors hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-lg"
          href="/discover"
        >
          Melodarr
        </Link>

        {user ? (
          <>
            <nav className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-sm" aria-label="Main navigation">
              {[
                { href: "/discover", label: "Discover" },
                { href: "/requests", label: "Requests" }
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href as Route}
                  aria-current={isActive(href) ? "page" : undefined}
                  className={`rounded-lg px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    isActive(href)
                      ? "bg-accent/10 text-accent"
                      : "text-muted hover:text-text hover:bg-[var(--hover-bg)]"
                  }`}
                >
                  {label}
                </Link>
              ))}
              {user.role === "ADMIN"
                ? [
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
                          : "text-muted hover:text-text hover:bg-[var(--hover-bg)]"
                      }`}
                    >
                      {label}
                    </Link>
                  ))
                : null}
            </nav>

            <div className="ml-auto flex items-center gap-3 text-sm text-muted">
              <span className="rounded-xl border border-[var(--edge)] bg-panel/50 px-3 py-1.5 text-muted">
                {user.username}
              </span>
              <LogoutButton />
            </div>
          </>
        ) : null}
      </div>
    </header>
  );
}
