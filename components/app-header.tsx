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

type NavItem = {
  href: Route;
  label: string;
};

const baseNavItems: NavItem[] = [
  { href: "/discover", label: "Discover" },
  { href: "/requests", label: "Requests" }
];

const adminNavItems: NavItem[] = [
  { href: "/admin/requests", label: "Manage Requests" },
  { href: "/admin/settings", label: "Settings" }
];

export function AppHeader({ user }: Props) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navItems = user?.role === "ADMIN" ? [...baseNavItems, ...adminNavItems] : baseNavItems;

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
      <div className="mx-auto flex w-full max-w-[min(1600px,calc(100vw-1.5rem))] flex-wrap items-center gap-3 px-4 sm:max-w-[min(1720px,calc(100vw-3rem))] sm:px-6">
        <Link
          className="shrink-0 rounded-lg font-brand text-2xl font-semibold tracking-tight text-accent transition-colors hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          href="/discover"
        >
          Melodarr
        </Link>

        {user ? (
          <>
            <nav
              className="hidden min-w-0 flex-1 flex-wrap items-center gap-1.5 text-sm md:flex"
              aria-label="Main navigation"
            >
              {navItems.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
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
            </nav>

            <div className="ml-auto flex min-w-0 items-center gap-2 text-sm text-muted sm:gap-3">
              <span
                className="inline-flex min-h-8 max-w-[34vw] items-center truncate rounded-lg border border-[var(--edge)] bg-panel/50 px-2.5 py-1 text-sm text-muted sm:max-w-48 md:max-w-56"
                title={user.username}
              >
                {user.username}
              </span>
              <div className="hidden md:block">
                <LogoutButton />
              </div>
              <button
                type="button"
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--edge)] bg-panel/70 px-3 text-sm font-medium text-text transition-colors hover:bg-[var(--hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:hidden"
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-main-navigation"
                aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
                onClick={() => setMobileMenuOpen((open) => !open)}
              >
                Menu
              </button>
            </div>

            {mobileMenuOpen ? (
              <nav
                id="mobile-main-navigation"
                className="flex w-full flex-col gap-2 rounded-2xl border border-[var(--edge)] bg-panel/95 p-2 text-sm shadow-lg md:hidden"
                aria-label="Mobile navigation"
              >
                {navItems.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileMenuOpen(false)}
                    aria-current={isActive(href) ? "page" : undefined}
                    className={`flex min-h-11 items-center rounded-xl px-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                      isActive(href)
                        ? "bg-accent/10 text-accent"
                        : "text-muted hover:bg-[var(--hover-bg)] hover:text-text"
                    }`}
                  >
                    {label}
                  </Link>
                ))}
                <div className="border-t border-[var(--edge)] pt-2">
                  <LogoutButton />
                </div>
              </nav>
            ) : null}
          </>
        ) : null}
      </div>
    </header>
  );
}
