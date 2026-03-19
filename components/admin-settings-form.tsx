"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { IconCheck, IconLink, IconSave } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast-provider";

type SettingsPayload = {
  appUrl: string | null;
  jellyfinUrl: string | null;
  jellyfinApiKey: string | null;
  lidarrUrl: string | null;
  lidarrApiKey: string | null;
  lidarrRootFolder: string | null;
  lidarrQualityProfileId: number | null;
  lidarrMetadataProfileId: number | null;
  lidarrMonitorMode: string;
  requestAutoApprove: boolean;
  debugMode: boolean;
};

type PasswordPayload = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const defaultState: SettingsPayload = {
  appUrl: "",
  jellyfinUrl: "",
  jellyfinApiKey: "",
  lidarrUrl: "",
  lidarrApiKey: "",
  lidarrRootFolder: "",
  lidarrQualityProfileId: null,
  lidarrMetadataProfileId: null,
  lidarrMonitorMode: "all",
  requestAutoApprove: true,
  debugMode: false
};

const defaultPasswordState: PasswordPayload = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: ""
};

export function AdminSettingsForm() {
  const [state, setState] = useState<SettingsPayload>(defaultState);
  const [passwordState, setPasswordState] = useState<PasswordPayload>(defaultPasswordState);
  const [canManagePassword, setCanManagePassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const run = async () => {
      const response = await fetch("/api/settings");
      const payload = (await response.json()) as {
        error?: string;
        config?: SettingsPayload;
        canManagePassword?: boolean;
      };

      if (response.ok && payload.config) {
        setState(payload.config);
        setCanManagePassword(Boolean(payload.canManagePassword));
      } else {
        toast.error(payload.error ?? "Failed to load settings", "Settings");
      }

      setLoading(false);
    };

    void run();
  }, [toast]);

  const normalizedPayload = (extra?: { testJellyfin?: boolean; testLidarr?: boolean }) => ({
    ...extra,
    appUrl: state.appUrl?.trim() ? state.appUrl.trim() : null,
    jellyfinUrl: state.jellyfinUrl?.trim() ? state.jellyfinUrl.trim() : null,
    jellyfinApiKey: state.jellyfinApiKey?.trim() ? state.jellyfinApiKey.trim() : null,
    lidarrUrl: state.lidarrUrl?.trim() ? state.lidarrUrl.trim() : null,
    lidarrApiKey: state.lidarrApiKey?.trim() ? state.lidarrApiKey.trim() : null,
    lidarrRootFolder: state.lidarrRootFolder?.trim() ? state.lidarrRootFolder.trim() : null,
    lidarrQualityProfileId: state.lidarrQualityProfileId,
    lidarrMetadataProfileId: state.lidarrMetadataProfileId,
    lidarrMonitorMode: state.lidarrMonitorMode?.trim() ? state.lidarrMonitorMode.trim() : "all",
    requestAutoApprove: state.requestAutoApprove,
    debugMode: state.debugMode
  });

  const sendUpdate = async (extra?: { testJellyfin?: boolean; testLidarr?: boolean }) => {
    const response = await fetch("/api/settings", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(normalizedPayload(extra))
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      toast.error(payload.error ?? "Failed to update settings", "Settings");
      return false;
    }

    return true;
  };

  const changePasswordIfNeeded = async () => {
    if (!canManagePassword) return true;

    const currentPassword = passwordState.currentPassword.trim();
    const newPassword = passwordState.newPassword;
    const confirmPassword = passwordState.confirmPassword;

    const hasAnyPasswordInput = Boolean(currentPassword || newPassword || confirmPassword);
    if (!hasAnyPasswordInput) {
      return true;
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("To change password, complete all password fields.", "Password");
      return false;
    }

    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.", "Password");
      return false;
    }

    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation do not match.", "Password");
      return false;
    }

    if (currentPassword === newPassword) {
      toast.error("New password must be different from current password.", "Password");
      return false;
    }

    const response = await fetch("/api/auth/password", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        currentPassword,
        newPassword
      })
    });

    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      toast.error(payload.error ?? "Password update failed", "Password");
      return false;
    }

    setPasswordState(defaultPasswordState);
    return true;
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);

    const changedPassword = Boolean(
      passwordState.currentPassword.trim() || passwordState.newPassword || passwordState.confirmPassword
    );

    const passwordOk = await changePasswordIfNeeded();
    if (!passwordOk) {
      setSaving(false);
      return;
    }

    const settingsOk = await sendUpdate();
    setSaving(false);

    if (settingsOk) {
      toast.success(changedPassword ? "Settings and password updated." : "Settings saved.", "Settings");
    }
  };

  const testConnection = async (service: "jellyfin" | "lidarr") => {
    setSaving(true);

    const ok =
      service === "jellyfin"
        ? await sendUpdate({ testJellyfin: true })
        : await sendUpdate({ testLidarr: true });

    setSaving(false);

    if (ok) {
      toast.success(
        service === "jellyfin" ? "Jellyfin connection succeeded." : "Lidarr connection succeeded.",
        "Connection Test"
      );
    }
  };

  if (loading) {
    return (
      <Card className="space-y-6">
        <div className="skeleton h-8 w-32" />
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-24 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-8">
      <div className="pb-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Settings</h1>
      </div>

      <form className="grid gap-8 lg:grid-cols-2" onSubmit={save}>
        {/* Left column — integrations */}
        <div className="space-y-6">
          {/* Application Section */}
          <section className="space-y-4 rounded-2xl border border-white/[0.08] bg-panel-2/30 p-5">
            <h2 className="section-heading flex items-center gap-2">
              <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Application
            </h2>
            <label className="block text-sm">
              <span className="mb-2 block text-muted">Public App URL</span>
              <input
                type="url"
                value={state.appUrl ?? ""}
                onChange={(event) => setState((prev) => ({ ...prev, appUrl: event.target.value }))}
                className="field"
                placeholder="https://melodarr.example.com"
              />
            </label>
          </section>

          {/* Jellyfin Section */}
          <section className="space-y-4 rounded-2xl border border-white/[0.08] bg-panel-2/30 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff]/5 border border-white/10" aria-label="Jellyfin">
                <Image src="/brands/jellyfin.svg" alt="" aria-hidden width={22} height={22} />
              </div>
              <h2 className="section-heading leading-none">Jellyfin</h2>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => void testConnection("jellyfin")}
              className="btn-ghost w-fit rounded-lg text-xs"
            >
              <IconLink className="h-4 w-4" />
              Test Connection
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-2 block text-muted">Server URL</span>
              <input
                type="url"
                value={state.jellyfinUrl ?? ""}
                onChange={(event) =>
                  setState((prev) => ({ ...prev, jellyfinUrl: event.target.value }))
                }
                className="field"
                placeholder="http://jellyfin:8096"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-2 block text-muted">API Key</span>
              <input
                value={state.jellyfinApiKey ?? ""}
                onChange={(event) =>
                  setState((prev) => ({ ...prev, jellyfinApiKey: event.target.value }))
                }
                className="field"
                placeholder="Paste API key"
              />
            </label>
          </div>
        </section>

        {/* Lidarr Section */}
        <section className="space-y-4 rounded-2xl border border-white/[0.08] bg-panel-2/30 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl brand-lidarr-icon" aria-label="Lidarr">
                <Image src="/brands/lidarr.svg" alt="" aria-hidden width={22} height={22} className="h-5 w-5" />
              </div>
              <h2 className="section-heading leading-none">Lidarr</h2>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => void testConnection("lidarr")}
              className="btn-ghost w-fit rounded-lg text-xs"
            >
              <IconLink className="h-4 w-4" />
              Test Connection
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-2 block text-muted">Server URL</span>
              <input
                type="url"
                value={state.lidarrUrl ?? ""}
                onChange={(event) => setState((prev) => ({ ...prev, lidarrUrl: event.target.value }))}
                className="field"
                placeholder="http://lidarr:8686"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-2 block text-muted">API Key</span>
              <input
                value={state.lidarrApiKey ?? ""}
                onChange={(event) =>
                  setState((prev) => ({ ...prev, lidarrApiKey: event.target.value }))
                }
                className="field"
                placeholder="Paste API key"
              />
            </label>

            <label className="block text-sm">
              <span className="mb-2 block text-muted">Root Folder</span>
              <input
                value={state.lidarrRootFolder ?? ""}
                onChange={(event) =>
                  setState((prev) => ({ ...prev, lidarrRootFolder: event.target.value }))
                }
                className="field"
                placeholder="/music"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-2 block text-muted">Quality Profile ID</span>
              <input
                type="number"
                value={state.lidarrQualityProfileId ?? ""}
                onChange={(event) =>
                  setState((prev) => ({
                    ...prev,
                    lidarrQualityProfileId: event.target.value ? Number(event.target.value) : null
                  }))
                }
                className="field"
                placeholder="1"
              />
            </label>

            <label className="block text-sm md:col-span-2">
              <span className="mb-2 block text-muted">Metadata Profile ID (optional)</span>
              <input
                type="number"
                value={state.lidarrMetadataProfileId ?? ""}
                onChange={(event) =>
                  setState((prev) => ({
                    ...prev,
                    lidarrMetadataProfileId: event.target.value ? Number(event.target.value) : null
                  }))
                }
                className="field"
                placeholder="Optional"
              />
            </label>
          </div>
        </section>
        </div>

        {/* Right column — behavior & security */}
        <div className="space-y-6">
        {/* Auto Approve Toggle */}
        <button
          type="button"
          role="switch"
          aria-checked={state.requestAutoApprove}
          onClick={() =>
            setState((prev) => ({ ...prev, requestAutoApprove: !prev.requestAutoApprove }))
          }
          className="flex w-full items-center gap-4 rounded-2xl border border-white/[0.08] bg-panel-2/30 p-5 text-left text-sm text-muted transition hover:border-white/[0.15] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
        >
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition-all ${
              state.requestAutoApprove
                ? "border-accent/60 bg-accent/20 text-accent"
                : "border-white/[0.15] bg-transparent text-transparent"
            }`}
            aria-hidden
          >
            <IconCheck className="h-4 w-4" />
          </span>
          <span className="leading-none">
            <span className="font-medium text-text">Automatically approve requests</span>
            <span className="ml-2 text-xs text-muted">(Skip moderation queue)</span>
          </span>
        </button>

        {/* Debug Mode Toggle */}
        <button
          type="button"
          role="switch"
          aria-checked={state.debugMode}
          onClick={() =>
            setState((prev) => ({ ...prev, debugMode: !prev.debugMode }))
          }
          className="flex w-full items-center gap-4 rounded-2xl border border-white/[0.08] bg-panel-2/30 p-5 text-left text-sm text-muted transition hover:border-white/[0.15] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
        >
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition-all ${
              state.debugMode
                ? "border-accent/60 bg-accent/20 text-accent"
                : "border-white/[0.15] bg-transparent text-transparent"
            }`}
            aria-hidden
          >
            <IconCheck className="h-4 w-4" />
          </span>
          <span className="leading-none">
            <span className="font-medium text-text">Debug mode</span>
            <span className="ml-2 text-xs text-muted">(Enable verbose logging)</span>
          </span>
        </button>

        {/* Password Section */}
        {canManagePassword ? (
          <section className="space-y-4 rounded-2xl border border-white/[0.08] bg-panel-2/30 p-5">
            <div>
              <h2 className="section-heading flex items-center gap-2">
                <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                Change Password
              </h2>
            </div>
            <div className="space-y-4">
              <label className="block text-sm">
                <span className="mb-2 block text-muted">Current Password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  maxLength={128}
                  value={passwordState.currentPassword}
                  onChange={(event) =>
                    setPasswordState((prev) => ({ ...prev, currentPassword: event.target.value }))
                  }
                  className="field"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-2 block text-muted">New Password</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={128}
                    value={passwordState.newPassword}
                    onChange={(event) =>
                      setPasswordState((prev) => ({ ...prev, newPassword: event.target.value }))
                    }
                    className="field"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-2 block text-muted">Confirm New Password</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={128}
                    value={passwordState.confirmPassword}
                    onChange={(event) =>
                      setPasswordState((prev) => ({ ...prev, confirmPassword: event.target.value }))
                    }
                    className="field"
                  />
                </label>
              </div>
            </div>
          </section>
        ) : null}

        <button type="submit" disabled={saving} className="btn-primary w-full py-3">
          {saving ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Saving...
            </span>
          ) : (
            <>
              <IconSave className="h-4 w-4" />
              Save Changes
            </>
          )}
        </button>
        </div>
      </form>
    </Card>
  );
}
