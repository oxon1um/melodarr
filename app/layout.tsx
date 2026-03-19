import type { Metadata } from "next";
import Link from "next/link";
import { Syne, DM_Sans } from "next/font/google";
import { getCurrentUser } from "@/lib/auth/server";
import { ToastProvider } from "@/components/ui/toast-provider";
import { LogoutButton } from "@/components/ui/logout-button";
import "@/styles/globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap"
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Melodarr",
  description: "Music discovery and request management for Lidarr"
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={`${syne.variable} ${dmSans.variable}`}>
        <ToastProvider>
          <div className="relative min-h-screen text-text">
            {/* Header */}
            <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#03070d]/70 backdrop-blur-xl">
              <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    className="font-display text-2xl font-semibold tracking-tight text-accent transition-colors hover:text-accent-hover"
                    href="/discover"
                  >
                    Melodarr
                  </Link>
                  {user ? (
                    <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
                      <Link className="btn-ghost rounded-lg px-3 py-1.5" href="/discover">
                        Discover
                      </Link>
                      <Link className="btn-ghost rounded-lg px-3 py-1.5" href="/requests">
                        Requests
                      </Link>
                      {user.role === "ADMIN" ? (
                        <>
                          <Link className="btn-ghost rounded-lg px-3 py-1.5" href="/admin/requests">
                            Manage Requests
                          </Link>
                          <Link className="btn-ghost rounded-lg px-3 py-1.5" href="/admin/settings">
                            Settings
                          </Link>
                        </>
                      ) : null}
                    </nav>
                  ) : null}
                </div>
                <div className="flex items-center gap-3 text-sm text-muted md:self-auto">
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

            {/* Main content */}
            <main className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
