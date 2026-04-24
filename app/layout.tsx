import type { Metadata } from "next";
import { Syne, DM_Sans } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast-provider";
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

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={`${syne.variable} ${dmSans.variable}`}>
        <ToastProvider>
          <div className="relative min-h-screen text-text">
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-[var(--btn-primary-text)] focus:shadow-lg"
            >
              Skip to main content
            </a>

            {children}
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
