import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("noisy singles UI", () => {
  it("does not render the hide noisy singles toggle label in discover or artist detail views", async () => {
    const [discoverSource, artistSource] = await Promise.all([
      readFile(new URL("../components/discover-client.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/discover/[artistId]/page.tsx", import.meta.url), "utf8"),
    ]);

    expect(discoverSource).not.toContain("Hide noise");
    expect(artistSource).not.toContain("Hide Noisy Singles");
  });
});
