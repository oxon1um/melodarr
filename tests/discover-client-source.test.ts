import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("discover landing state", () => {
  it("does not import or render the onboarding empty state", async () => {
    const source = await readFile(
      new URL("../components/discover-client.tsx", import.meta.url),
      "utf8"
    );

    expect(source).not.toContain('import { EmptyDiscoverState }');
    expect(source).not.toContain("<EmptyDiscoverState />");
  });
});
