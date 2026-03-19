"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast-provider";

type SetupState = {
  username: string;
  password: string;
  confirmPassword: string;
};

const initialState: SetupState = {
  username: "",
  password: "",
  confirmPassword: ""
};

export function SetupWizardForm() {
  const router = useRouter();
  const toast = useToast();
  const [state, setState] = useState<SetupState>(initialState);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (state.password !== state.confirmPassword) {
      toast.error("Passwords do not match.", "Setup");
      return;
    }

    setSaving(true);

    const response = await fetch("/api/setup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username: state.username.trim(),
        password: state.password
      })
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      toast.error(payload.error ?? "Setup failed", "Setup");
      setSaving(false);
      return;
    }

    router.replace("/admin/settings");
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* Hero */}
      <div className="text-center space-y-3">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10">
          <svg className="h-8 w-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.498l1.33-.377a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.498l1.33-.377a2.25 2.25 0 001.632-2.163z" />
          </svg>
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-accent">
          Welcome to Melodarr
        </h1>
        <p className="text-muted max-w-sm mx-auto">
          Create your administrator account to get started. You can configure integrations after setup.
        </p>
      </div>

      {/* Form card */}
      <form className="panel space-y-8 p-6 sm:p-8" onSubmit={onSubmit}>
        {/* Account section */}
        <section className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent text-sm font-semibold">
              1
            </div>
            <h2 className="section-heading">Administrator Account</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-2 block text-muted">Username</span>
              <input
                required
                autoComplete="username"
                maxLength={100}
                value={state.username}
                onChange={(event) => setState((prev) => ({ ...prev, username: event.target.value }))}
                className="field"
                placeholder="Choose a username"
              />
            </label>
            <div />

            <label className="block text-sm">
              <span className="mb-2 block text-muted">Password</span>
              <input
                required
                autoComplete="new-password"
                type="password"
                minLength={8}
                maxLength={128}
                value={state.password}
                onChange={(event) => setState((prev) => ({ ...prev, password: event.target.value }))}
                className="field"
                placeholder="Create a password"
              />
            </label>

            <label className="block text-sm">
              <span className="mb-2 block text-muted">Confirm Password</span>
              <input
                required
                autoComplete="new-password"
                type="password"
                minLength={8}
                maxLength={128}
                value={state.confirmPassword}
                onChange={(event) =>
                  setState((prev) => ({ ...prev, confirmPassword: event.target.value }))
                }
                className="field"
                placeholder="Confirm your password"
              />
            </label>
          </div>
        </section>

        {/* Next steps hint */}
        <div className="rounded-xl border border-accent/10 bg-accent/5 p-4 space-y-2">
          <p className="text-sm font-medium text-accent/90">What happens next</p>
          <ul className="text-sm text-muted space-y-1.5">
            <li className="flex items-start gap-2">
              <svg className="h-4 w-4 mt-0.5 text-accent/60 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              <span>Create your admin account</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="h-4 w-4 mt-0.5 text-accent/60 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              <span>Configure Jellyfin and Lidarr in Settings</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="h-4 w-4 mt-0.5 text-accent/60 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              <span>Start discovering and requesting music</span>
            </li>
          </ul>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="btn-primary w-full py-3.5"
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Creating account...
            </span>
          ) : (
            "Create Administrator"
          )}
        </button>
      </form>

      {/* Integrations note */}
      <p className="text-center text-sm text-muted/70">
        You can connect Jellyfin and Lidarr from Settings after setup.
      </p>
    </div>
  );
}
