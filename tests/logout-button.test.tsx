// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace,
    refresh,
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("LogoutButton", () => {
  it("posts to logout and redirects after a successful response", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    const { ToastProvider } = await import("../components/ui/toast-provider");
    const { LogoutButton } = await import("../components/ui/logout-button");

    render(
      <ToastProvider>
        <LogoutButton />
      </ToastProvider>
    );

    await user.click(screen.getByRole("button", { name: "Log out" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("does not redirect when logout fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "Request origin is not allowed" }), { status: 403 })
      )
    );
    const user = userEvent.setup();
    const { ToastProvider } = await import("../components/ui/toast-provider");
    const { LogoutButton } = await import("../components/ui/logout-button");

    render(
      <ToastProvider>
        <LogoutButton />
      </ToastProvider>
    );

    await user.click(screen.getByRole("button", { name: "Log out" }));

    expect(await screen.findByText("Request origin is not allowed")).toBeDefined();
    await waitFor(() => {
      expect(screen.getByRole<HTMLButtonElement>("button", { name: "Log out" }).disabled).toBe(
        false
      );
    });
    expect(replace).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows a failure message when logout cannot be requested", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("Network failed"); }));
    const user = userEvent.setup();
    const { ToastProvider } = await import("../components/ui/toast-provider");
    const { LogoutButton } = await import("../components/ui/logout-button");

    render(
      <ToastProvider>
        <LogoutButton />
      </ToastProvider>
    );

    await user.click(screen.getByRole("button", { name: "Log out" }));

    expect(await screen.findByText("Could not log out. Please refresh and try again.")).toBeDefined();
    expect(replace).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("falls back to the default error when logout returns a non-JSON failure body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Proxy failure", { status: 502 })));
    const user = userEvent.setup();
    const { ToastProvider } = await import("../components/ui/toast-provider");
    const { LogoutButton } = await import("../components/ui/logout-button");

    render(
      <ToastProvider>
        <LogoutButton />
      </ToastProvider>
    );

    await user.click(screen.getByRole("button", { name: "Log out" }));

    expect(await screen.findByText("Could not log out. Please refresh and try again.")).toBeDefined();
    expect(replace).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});
