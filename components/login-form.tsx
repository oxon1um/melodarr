"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useToast } from "@/components/ui/toast-provider";

type LoginProvider = "local" | "jellyfin";

type LoginFormProps = {
  isHttps: boolean;
};

export function LoginForm({ isHttps }: LoginFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [localUsername, setLocalUsername] = useState("");
  const [localPassword, setLocalPassword] = useState("");
  const [jellyfinUsername, setJellyfinUsername] = useState("");
  const [jellyfinPassword, setJellyfinPassword] = useState("");
  const [loadingProvider, setLoadingProvider] = useState<LoginProvider | null>(null);

  const submitLogin = async (
    event: FormEvent,
    provider: LoginProvider,
    username: string,
    password: string
  ) => {
    event.preventDefault();
    setLoadingProvider(provider);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ provider, username, password })
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      toast.error(payload.error ?? "Login failed", provider === "local" ? "Local Sign-In" : "Jellyfin Sign-In");
      setLoadingProvider(null);
      return;
    }

    router.replace("/discover");
    router.refresh();
  };

  if (!isHttps) {
    return (
      <form
        className="panel page-enter mx-auto w-full max-w-md space-y-8 p-6 sm:p-8"
        onSubmit={(event) => void submitLogin(event, "local", localUsername, localPassword)}
      >
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight">Welcome Back</h1>
          <p className="text-sm text-muted">Sign in to your Melodarr account.</p>
        </div>

        <div className="space-y-4">
          <label className="block text-sm">
            <span className="mb-2 block text-muted">Username</span>
            <input
              required
              autoComplete="username"
              value={localUsername}
              onChange={(event) => setLocalUsername(event.target.value)}
              className="field"
              placeholder="Enter username"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block text-muted">Password</span>
            <input
              required
              autoComplete="current-password"
              type="password"
              value={localPassword}
              onChange={(event) => setLocalPassword(event.target.value)}
              className="field"
              placeholder="Enter password"
            />
          </label>
        </div>

        <button type="submit" disabled={loadingProvider !== null} className="btn-primary w-full py-3">
          {loadingProvider === "local" ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Signing in...
            </span>
          ) : (
            "Sign In"
          )}
        </button>
      </form>
    );
  }

  return (
    <div className="panel page-enter mx-auto w-full max-w-5xl space-y-8 p-6 sm:p-8">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Welcome Back</h1>
        <p className="text-sm text-muted">Sign in with Jellyfin or your local admin account.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <form
          className="group relative space-y-4 rounded-2xl border border-white/[0.08] bg-panel-2/30 p-5 transition-colors hover:border-white/[0.15]"
          onSubmit={(event) =>
            void submitLogin(event, "jellyfin", jellyfinUsername, jellyfinPassword)
          }
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff]/5 border border-white/10" aria-label="Jellyfin">
              <Image src="/brands/jellyfin.svg" alt="" aria-hidden width={22} height={22} />
            </div>
            <div>
              <h2 className="section-heading">Jellyfin</h2>
              <p className="text-xs text-muted">Sign in with your Jellyfin username and password</p>
            </div>
          </div>

          <label className="block text-sm">
            <span className="mb-2 block text-muted">Username</span>
            <input
              required
              autoComplete="username"
              value={jellyfinUsername}
              onChange={(event) => setJellyfinUsername(event.target.value)}
              className="field"
              placeholder="Jellyfin username"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block text-muted">Password</span>
            <input
              required
              autoComplete="current-password"
              type="password"
              value={jellyfinPassword}
              onChange={(event) => setJellyfinPassword(event.target.value)}
              className="field"
              placeholder="Jellyfin password"
            />
          </label>

          <button type="submit" disabled={loadingProvider !== null} className="btn-primary w-full py-2.5">
            {loadingProvider === "jellyfin" ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Signing in...
              </span>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <form
          className="group relative space-y-4 rounded-2xl border border-white/[0.08] bg-panel-2/30 p-5 transition-colors hover:border-white/[0.15]"
          onSubmit={(event) => void submitLogin(event, "local", localUsername, localPassword)}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 border border-accent/20">
              <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h2 className="section-heading">Local Admin</h2>
              <p className="text-xs text-muted">Sign in with your admin username and password</p>
            </div>
          </div>

          <label className="block text-sm">
            <span className="mb-2 block text-muted">Username</span>
            <input
              required
              autoComplete="username"
              value={localUsername}
              onChange={(event) => setLocalUsername(event.target.value)}
              className="field"
              placeholder="Admin username"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block text-muted">Password</span>
            <input
              required
              autoComplete="current-password"
              type="password"
              value={localPassword}
              onChange={(event) => setLocalPassword(event.target.value)}
              className="field"
              placeholder="Admin password"
            />
          </label>

          <button type="submit" disabled={loadingProvider !== null} className="btn-primary w-full py-2.5">
            {loadingProvider === "local" ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Signing in...
              </span>
            ) : (
              "Sign In"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
