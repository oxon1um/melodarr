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
    <form className="panel page-enter mx-auto max-w-2xl space-y-8 p-6 sm:p-8" onSubmit={onSubmit}>
      <div className="space-y-2">
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          <span className="bg-gradient-to-r from-accent via-accent-glow to-[#a78bfa] bg-clip-text text-transparent">
            Welcome to Melodarr
          </span>
        </h1>
        <p className="text-sm text-muted">Create your administrator account to get started.</p>
      </div>

      <section className="space-y-5">
        <h2 className="section-heading flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent/10 text-accent text-xs">
            1
          </span>
          Administrator Account
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-2 block text-muted">Username</span>
            <input
              required
              value={state.username}
              onChange={(event) => setState((prev) => ({ ...prev, username: event.target.value }))}
              className="field"
              placeholder="Choose a username"
            />
          </label>
          <div />
          <label className="block text-sm sm:col-span-1">
            <span className="mb-2 block text-muted">Password</span>
            <input
              required
              type="password"
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
              type="password"
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

      <p className="rounded-xl border border-white/[0.06] bg-panel-2/30 p-4 text-sm text-muted">
        You can connect Jellyfin and Lidarr from{" "}
        <span className="text-accent-glow font-medium">Settings</span> after completing setup.
      </p>

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
  );
}
