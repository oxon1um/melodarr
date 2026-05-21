// @vitest-environment jsdom

import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const usePathname = vi.fn();

vi.mock("next/image", () => ({
  default: ({
    alt,
    priority: _priority,
    src,
    unoptimized: _unoptimized,
    ...props
  }: {
    alt?: string;
    priority?: boolean;
    src: string;
    unoptimized?: boolean;
  }) => {
    void _priority;
    void _unoptimized;
    // Rendering a plain img keeps the Next.js image mock deterministic in jsdom.
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={alt} src={src} {...props} />;
  }
}));

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

    const { container } = render(<AppHeader user={{ username: "very-long-admin-username", role: "ADMIN" }} />);

    screen.getByRole("link", { name: "Melodarr" });
    const brandLogo = container.querySelector('a[href="/discover"] img[src="/brands/melodarr.png"]');
    expect(brandLogo).not.toBeNull();

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
