"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconLogout } from "@/components/ui/icons";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const onLogout = async () => {
    setLoading(true);
    await fetch("/api/auth/logout", {
      method: "POST"
    });
    router.replace("/login");
    router.refresh();
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
