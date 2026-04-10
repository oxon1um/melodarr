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
  it("renders account utilities in a right-aligned header zone", async () => {
    usePathname.mockReturnValue("/discover");

    const { AppHeader } = await import("../components/app-header");
    const markup = renderToStaticMarkup(
      <AppHeader user={{ username: "test", role: "ADMIN" }} />
    );

    expect(markup).toContain("Main navigation");
    expect(markup).toContain("ml-auto flex items-center gap-3");
    expect(markup).toContain(">test<");
    expect(markup).toContain(">Logout<");
  });
});
