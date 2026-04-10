import { describe, expect, it } from "vitest";

describe("image selection", () => {
  it("falls back to the first optimized image when no preferred cover type matches", async () => {
    const { pickPreferredImageUrl } = await import("../lib/image-selection");

    expect(
      pickPreferredImageUrl(
        [
          {
            coverType: "logo",
            optimizedUrl: "/api/image?src=https%3A%2F%2Fexample.com%2Fartist.jpg",
            remoteUrl: "https://example.com/artist.jpg"
          }
        ],
        ["poster", "cover", "fanart", "banner"]
      )
    ).toBe("/api/image?src=https%3A%2F%2Fexample.com%2Fartist.jpg");
  });

  it("prefers optimized URLs for matching cover types before raw remote URLs", async () => {
    const { pickPreferredImageUrl } = await import("../lib/image-selection");

    expect(
      pickPreferredImageUrl(
        [
          {
            coverType: "cover",
            optimizedUrl: "/api/image?src=https%3A%2F%2Fexample.com%2Falbum.jpg",
            remoteUrl: "https://example.com/album.jpg"
          },
          {
            coverType: "poster",
            optimizedUrl: "/api/image?src=https%3A%2F%2Fexample.com%2Fposter.jpg",
            remoteUrl: "https://example.com/poster.jpg"
          }
        ],
        ["cover", "poster"]
      )
    ).toBe("/api/image?src=https%3A%2F%2Fexample.com%2Falbum.jpg");
  });
});
