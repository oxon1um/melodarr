import { describe, expect, it } from "vitest";
import { isSignedProxyImageSrc } from "../components/ui/cover-image";

describe("isSignedProxyImageSrc", () => {
  it("returns true for signed local image proxy paths", () => {
    expect(isSignedProxyImageSrc("/api/image?src=https%3A%2F%2Fimages.example%2Fcover.jpg&exp=1&sig=ok")).toBe(true);
  });

  it("returns false for non-proxy image URLs", () => {
    expect(isSignedProxyImageSrc("/_next/image?url=%2Fapi%2Fimage%3Fsrc%3Dok&w=640&q=75")).toBe(false);
    expect(isSignedProxyImageSrc("https://images.example/cover.jpg")).toBe(false);
  });
});
