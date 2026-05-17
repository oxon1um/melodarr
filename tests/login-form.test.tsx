// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const replace = vi.fn();
const refresh = vi.fn();
const error = vi.fn();

vi.mock("next/image", () => ({
  default: ({
    alt,
    priority: _priority,
    src,
    ...props
  }: {
    alt?: string;
    priority?: boolean;
    src: string;
  }) => {
    void _priority;
    // Rendering a plain img keeps the Next.js image mock deterministic in jsdom.
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={alt} src={src} {...props} />;
  }
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace,
    refresh
  })
}));

vi.mock("@/components/ui/toast-provider", () => ({
  useToast: () => ({
    error
  })
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("LoginForm", () => {
  it("renders the branded logo on the local-only login screen", async () => {
    const { LoginForm } = await import("../components/login-form");

    const { container } = render(<LoginForm isHttps={false} />);

    expect(screen.getByRole("heading", { name: "Melodarr" })).toBeDefined();
    expect(container.querySelector('img[src="/brands/melodarr.svg"]')).not.toBeNull();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeDefined();
    expect(screen.queryByText("Jellyfin")).toBeNull();
  });

  it("renders the branded logo on the HTTPS dual-provider login screen", async () => {
    const { LoginForm } = await import("../components/login-form");

    const { container } = render(<LoginForm isHttps />);

    expect(screen.getByRole("heading", { name: "Melodarr" })).toBeDefined();
    expect(container.querySelector('img[src="/brands/melodarr.svg"]')).not.toBeNull();
    expect(screen.getByText("Jellyfin")).toBeDefined();
    expect(screen.getByText("Local Admin")).toBeDefined();
  });
});
