"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconLogout } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast-provider";

const DEFAULT_LOGOUT_ERROR = "Could not log out. Please refresh and try again.";

const getLogoutError = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? DEFAULT_LOGOUT_ERROR;
  } catch {
    return DEFAULT_LOGOUT_ERROR;
  }
};

export function LogoutButton() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  const onLogout = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store"
      });

      if (!response.ok) {
        toast.error(await getLogoutError(response), "Logout");
        setLoading(false);
        return;
      }

      router.replace("/login");
      router.refresh();
    } catch {
      toast.error(DEFAULT_LOGOUT_ERROR, "Logout");
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onLogout}
      disabled={loading}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[color:color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--danger)_14%,transparent)_0%,color-mix(in_srgb,var(--danger)_8%,transparent)_100%)] text-[var(--danger)] transition-colors hover:border-[color:color-mix(in_srgb,var(--danger)_60%,transparent)] hover:bg-[linear-gradient(135deg,color-mix(in_srgb,var(--danger)_18%,transparent)_0%,color-mix(in_srgb,var(--danger)_12%,transparent)_100%)] hover:text-[var(--danger-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-60"
      aria-label="Log out"
      title={loading ? "Logging out..." : "Log out"}
    >
      <IconLogout className="h-4 w-4" />
      <span className="sr-only">{loading ? "Logging out" : "Log out"}</span>
    </button>
  );
}
