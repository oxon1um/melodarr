// @vitest-environment jsdom

import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const usePathname = vi.fn();

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    children: ReactNode;
    href: string;
  }) => (
    <a
      href={href}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        event.preventDefault();
        onClick?.(event);
      }}
      {...props}
    >
      {children}
    </a>
  )
}));

vi.mock("next/navigation", () => ({
  usePathname
}));

vi.mock("@/components/ui/logout-button", () => ({
  LogoutButton: () => <button type="button">Logout</button>
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AppHeader", () => {
  it("opens mobile navigation and closes it from a selected link", async () => {
    usePathname.mockReturnValue("/discover");
    const user = userEvent.setup();
    const { AppHeader } = await import("../components/app-header");

    render(<AppHeader user={{ username: "very-long-admin-username", role: "ADMIN" }} />);

    const menuButton = screen.getByRole("button", { name: "Open navigation menu" });
    expect(menuButton.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("navigation", { name: "Mobile navigation" })).toBeNull();

    await user.click(menuButton);

    expect(menuButton.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", { name: "Close navigation menu" })).toBe(menuButton);

    const mobileNavigation = screen.getByRole("navigation", { name: "Mobile navigation" });
    expect(within(mobileNavigation).getByRole("link", { name: "Discover" })).toBeDefined();
    expect(within(mobileNavigation).getByRole("link", { name: "Requests" })).toBeDefined();
    expect(within(mobileNavigation).getByRole("link", { name: "Manage Requests" })).toBeDefined();
    expect(within(mobileNavigation).getByRole("link", { name: "Settings" })).toBeDefined();
    expect(within(mobileNavigation).getByRole("button", { name: "Logout" })).toBeDefined();

    await user.click(within(mobileNavigation).getByRole("link", { name: "Requests" }));

    expect(menuButton.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("navigation", { name: "Mobile navigation" })).toBeNull();
  });
});
