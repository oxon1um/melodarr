import { describe, expect, it } from "vitest";
import { filterNoisySingles, isNoisySingle, sortReleases } from "../lib/discover/release-browser";

describe("release-browser utilities", () => {
  it("sorts releases by newest date first with title fallback", () => {
    const releases = [
      { title: "Boy", releaseDate: "1980-10-20" },
      { title: "War", releaseDate: "1983-02-28" },
      { title: "October", releaseDate: "1981-10-12" },
      { title: "Unknown Date" }
    ];

    expect(sortReleases(releases, "newest").map((release) => release.title)).toEqual([
      "War",
      "October",
      "Boy",
      "Unknown Date"
    ]);
  });

  it("sorts releases alphabetically descending", () => {
    const releases = [
      { title: "Boy" },
      { title: "War" },
      { title: "October" }
    ];

    expect(sortReleases(releases, "za").map((release) => release.title)).toEqual([
      "War",
      "October",
      "Boy"
    ]);
  });

  it("filters noisy singles only when the toggle is enabled", () => {
    const singles = [
      { title: "One", releaseStatuses: ["Official"] },
      { title: "One (Remix)", releaseStatuses: ["Official"] },
      { title: "Promo Track", releaseStatuses: ["Promotion"] }
    ];

    expect(isNoisySingle(singles[1])).toBe(true);
    expect(filterNoisySingles(singles, false)).toHaveLength(3);
    expect(filterNoisySingles(singles, true).map((release) => release.title)).toEqual(["One"]);
  });
});
