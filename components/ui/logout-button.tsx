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
      className="icon-btn icon-btn-danger"
      aria-label="Log out"
      title={loading ? "Logging out..." : "Log out"}
    >
      <IconLogout className="h-4 w-4" />
      <span className="sr-only">{loading ? "Logging out" : "Log out"}</span>
    </button>
  );
}
