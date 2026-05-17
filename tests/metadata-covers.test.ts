import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/redis", () => ({
  redis: null
}));

type TestFetchJson = <T>(url: string) => Promise<T | null>;

describe("cover fallback metadata", () => {
  beforeEach(async () => {
    const { clearJsonCache } = await import("../lib/cache/json-cache");
    clearJsonCache();
  });

  it("prefers Cover Art Archive front covers before iTunes", async () => {
    const { getCoverFallbackImages } = await import("../lib/metadata/covers");
    const fetchJsonMock = vi.fn(async (url: string): Promise<unknown> => {
      if (url.startsWith("https://coverartarchive.org/release-group/")) {
        return {
          images: [
            {
              front: false,
              image: "https://coverartarchive.org/release/album/back.jpg"
            },
            {
              front: true,
              thumbnails: {
                "1200": "https://coverartarchive.org/release/album/front-1200.jpg",
                "500": "https://coverartarchive.org/release/album/front-500.jpg"
              }
            }
          ]
        };
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    const fetchJson: TestFetchJson = async <T>(url: string): Promise<T | null> =>
      (await fetchJsonMock(url)) as T | null;

    await expect(
      getCoverFallbackImages({
        foreignAlbumId: "release-group-1",
        artistName: "Stromae",
        albumTitle: "Racine carrée",
        releaseDate: "2013-08-16"
      }, fetchJson)
    ).resolves.toEqual([
      {
        coverType: "cover",
        remoteUrl: "https://coverartarchive.org/release/album/front-1200.jpg"
      },
      {
        coverType: "cover",
        remoteUrl: "https://coverartarchive.org/release/album/back.jpg"
      }
    ]);
    expect(fetchJsonMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to iTunes only for strict artist, title, and year matches", async () => {
    const { getCoverFallbackImages } = await import("../lib/metadata/covers");
    const fetchJsonMock = vi.fn(async (url: string): Promise<unknown> => {
      if (url.startsWith("https://coverartarchive.org/release-group/")) {
        return null;
      }

      if (url.startsWith("https://itunes.apple.com/search?")) {
        return {
          results: [
            {
              artistName: "Stromae",
              collectionName: "Wrong Album",
              releaseDate: "2013-01-01",
              artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music/wrong/100x100bb.jpg"
            },
            {
              artistName: "Stromae",
              collectionName: "Racine carrée",
              releaseDate: "2014-01-01",
              artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music/wrong-year/100x100bb.jpg"
            },
            {
              artistName: "Stromae",
              collectionName: "Racine carrée",
              releaseDate: "2013-08-16T07:00:00Z",
              artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music/match/100x100bb.jpg"
            }
          ]
        };
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    const fetchJson: TestFetchJson = async <T>(url: string): Promise<T | null> =>
      (await fetchJsonMock(url)) as T | null;

    await expect(
      getCoverFallbackImages({
        foreignAlbumId: "release-group-2",
        artistName: "Stromae",
        albumTitle: "Racine carrée",
        releaseDate: "2013-08-16"
      }, fetchJson)
    ).resolves.toEqual([
      {
        coverType: "cover",
        remoteUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music/match/1200x1200bb.jpg"
      }
    ]);
  });

  it("caches empty fallback results", async () => {
    const { getCoverFallbackImages } = await import("../lib/metadata/covers");
    const fetchJsonMock = vi.fn(async (): Promise<unknown> => null);
    const fetchJson: TestFetchJson = async <T>(url: string): Promise<T | null> =>
      (await fetchJsonMock(url)) as T | null;

    const input = {
      foreignAlbumId: "release-group-empty",
      artistName: "Unknown Artist",
      albumTitle: "Unknown Album"
    };

    await expect(getCoverFallbackImages(input, fetchJson)).resolves.toBeUndefined();
    await expect(getCoverFallbackImages(input, fetchJson)).resolves.toBeUndefined();

    expect(fetchJsonMock).toHaveBeenCalledTimes(2);
  });
});
