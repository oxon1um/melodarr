import { describe, expect, it } from "vitest";

import { getSafeReturnPath } from "../lib/navigation/return-path";

describe("getSafeReturnPath", () => {
  it("keeps app-relative paths", () => {
    expect(getSafeReturnPath("/discover")).toBe("/discover");
    expect(getSafeReturnPath("/discover/artist-1?artistName=Name&view=grid")).toBe(
      "/discover/artist-1?artistName=Name&view=grid"
    );
  });

  it("rejects external and scheme-based URLs", () => {
    expect(getSafeReturnPath("https://example.com", "/requests")).toBe("/requests");
    expect(getSafeReturnPath("//example.com/path", "/requests")).toBe("/requests");
    expect(getSafeReturnPath("javascript:alert(1)", "/requests")).toBe("/requests");
    expect(getSafeReturnPath("data:text/html,hello", "/requests")).toBe("/requests");
  });

  it("rejects empty, whitespace-only, and malformed values", () => {
    expect(getSafeReturnPath(null, "/requests")).toBe("/requests");
    expect(getSafeReturnPath("   ", "/requests")).toBe("/requests");
    expect(getSafeReturnPath("discover", "/requests")).toBe("/requests");
    expect(getSafeReturnPath("/discover\n//example.com", "/requests")).toBe("/requests");
  });
});
