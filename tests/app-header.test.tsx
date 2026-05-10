import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const usePathname = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname
}));

vi.mock("@/components/ui/logout-button", () => ({
  LogoutButton: () => <button type="button">Logout</button>
}));

describe("AppHeader", () => {
  it("renders responsive account utilities in a right-aligned header zone", async () => {
    usePathname.mockReturnValue("/discover");

    const { AppHeader } = await import("../components/app-header");
    const markup = renderToStaticMarkup(
      <AppHeader user={{ username: "very-long-admin-username", role: "ADMIN" }} />
    );

    expect(markup).toContain("Main navigation");
    expect(markup).toContain("ml-auto flex min-w-0 items-center");
    expect(markup).toContain("truncate");
    expect(markup).toContain("title=\"very-long-admin-username\"");
    expect(markup).toContain(">very-long-admin-username<");
    expect(markup).toContain("aria-expanded=\"false\"");
    expect(markup).toContain("aria-controls=\"mobile-main-navigation\"");
    expect(markup).toContain("Open navigation menu");
    expect(markup).toContain(">Logout<");
  });
});
