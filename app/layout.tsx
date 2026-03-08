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
            {/* Aurora background effects */}
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
              <div className="aurora-blob aurora-blob-1" />
              <div className="aurora-blob aurora-blob-2" />
              <div className="aurora-blob aurora-blob-3" />
            </div>

            {/* Subtle gradient mesh overlay */}
            <div className="pointer-events-none fixed inset-0 opacity-30">
              <div className="absolute -left-32 top-20 h-80 w-80 rounded-full bg-[#3b6ee0]/15 blur-3xl" />
              <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-[#8b5cf6]/10 blur-3xl" />
              <div className="absolute -bottom-20 left-1/3 h-64 w-64 rounded-full bg-[#22d3ee]/10 blur-3xl" />
            </div>

            {/* Header */}
            <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#03070d]/70 backdrop-blur-xl">
              <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    className="font-display text-2xl font-semibold tracking-tight transition-colors hover:text-accent-glow"
                    href="/discover"
                  >
                    <span className="bg-gradient-to-r from-accent to-accent-glow bg-clip-text text-transparent">
                      Melodarr
                    </span>
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
