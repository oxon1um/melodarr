import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LidarrClient } from "../lib/lidarr/client";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });

const isFallbackLookupUrl = (url: string) =>
  url.includes("/api/v1/artist/lookup?term=lidarr:")
  || url.includes("/api/v1/album/lookup?term=lidarr:")
  || url.startsWith("https://api.lidarr.audio/api/v0.4/artist/")
  || url.startsWith("https://api.lidarr.audio/api/v0.4/album/");

describe("LidarrClient", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      try {
        const result = fetchMock(input, init);
        if (result !== undefined) {
          return result;
        }
      } catch (error) {
        if (isFallbackLookupUrl(url)) {
          return Promise.resolve(new Response("not found", { status: 404 }));
        }

        throw error;
      }

      if (isFallbackLookupUrl(url)) {
        return Promise.resolve(new Response("not found", { status: 404 }));
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
  });

  afterEach(() => {
    LidarrClient.clearCache();
    vi.unstubAllGlobals();
  });

  it("keeps the existing album when lookup results do not match the requested foreign album id", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/v1/album")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: 4,
              title: "Racine carree",
              foreignAlbumId: "album-1",
              images: [{ url: "/cover.jpg" }],
              artist: {
                artistName: "Stromae",
                foreignArtistId: "artist-1"
              }
            }
          ])
        );
      }

      if (url.includes("/api/v1/album/lookup?term=Racine%20carree")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: 9,
              title: "Wrong Album",
              foreignAlbumId: "album-2",
              artistName: "Someone Else",
              foreignArtistId: "artist-2"
            }
          ])
        );
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new LidarrClient("http://lidarr", "test-key");
    const album = await client.getAlbumByForeignId("album-1");

    expect(album).toMatchObject({
      title: "Racine carree",
      foreignAlbumId: "album-1",
      artistName: "Stromae",
      foreignArtistId: "artist-1"
    });
  });

  it("merges lookup artist metadata into existing library artists", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/v1/artist")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: 7,
              artistName: "Stromae",
              foreignArtistId: "artist-1",
              overview: "Library overview"
            }
          ])
        );
      }

      if (url.includes("/api/v1/artist/mbid/artist-1")) {
        return Promise.resolve(
          jsonResponse({
            id: 7,
            artistName: "Stromae",
            foreignArtistId: "artist-1",
            overview: "MBID overview"
          })
        );
      }

      if (url.includes("/api/v1/artist/lookup?term=Stromae")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: 7,
              artistName: "Stromae",
              foreignArtistId: "artist-1",
              overview: "Lookup overview",
              images: [{ url: "/lookup.jpg" }]
            }
          ])
        );
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new LidarrClient("http://lidarr", "test-key");
    const artist = await client.getArtistByForeignId("artist-1");

    expect(artist).toMatchObject({
      id: 7,
      artistName: "Stromae",
      foreignArtistId: "artist-1",
      overview: "Lookup overview",
      images: [{ url: "http://lidarr/lookup.jpg" }]
    });
  });

  it("filters unrelated artist lookup results when a specific query has exact matches", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/v1/artist/lookup?term=Stromae")) {
        return Promise.resolve(
          jsonResponse([
            {
              artistName: "Stromae",
              foreignArtistId: "artist-1"
            },
            {
              artistName: "Stromberger",
              foreignArtistId: "artist-2"
            },
            {
              artistName: "Stromkern",
              foreignArtistId: "artist-3"
            }
          ])
        );
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new LidarrClient("http://lidarr", "test-key");
    const artists = await client.searchArtists("Stromae");

    expect(artists).toEqual([
      expect.objectContaining({
        artistName: "Stromae",
        foreignArtistId: "artist-1"
      })
    ]);
  });

  it("keeps only the exact artist match for short exact queries like U2", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/v1/artist/lookup?term=U2")) {
        return Promise.resolve(
          jsonResponse([
            {
              artistName: "U2",
              foreignArtistId: "artist-u2"
            },
            {
              artistName: "U2 : The Tribute",
              foreignArtistId: "artist-tribute"
            },
            {
              artistName: "U2two",
              foreignArtistId: "artist-u2two"
            }
          ])
        );
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new LidarrClient("http://lidarr", "test-key");
    const artists = await client.searchArtists("U2");

    expect(artists).toEqual([
      expect.objectContaining({
        artistName: "U2",
        foreignArtistId: "artist-u2"
      })
    ]);
  });

  it("falls back to library metadata when lookup artist metadata is sparse", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/v1/artist")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: 7,
              artistName: "Stromae",
              foreignArtistId: "artist-1",
              overview: "Library overview",
              images: [{ url: "/library.jpg" }]
            }
          ])
        );
      }

      if (url.includes("/api/v1/artist/mbid/artist-1")) {
        return Promise.resolve(new Response("not found", { status: 404 }));
      }

      if (url.includes("/api/v1/artist/lookup?term=Stromae")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: 7,
              artistName: "Stromae",
              foreignArtistId: "artist-1"
            }
          ])
        );
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new LidarrClient("http://lidarr", "test-key");
    const artist = await client.getArtistByForeignId("artist-1");

    expect(artist).toMatchObject({
      overview: "Library overview",
      images: [{ url: "http://lidarr/library.jpg" }]
    });
  });

  it("fills missing artist overview from the public Lidarr artist profile", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/v1/artist")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: 7,
              artistName: "Stromae",
              foreignArtistId: "artist-1",
              images: [{ url: "/library.jpg" }]
            }
          ])
        );
      }

      if (url.includes("/api/v1/artist/mbid/artist-1")) {
        return Promise.resolve(new Response("not found", { status: 404 }));
      }

      if (url.includes("/api/v1/artist/lookup?term=lidarr%3Aartist-1")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: 7,
              artistName: "Stromae",
              foreignArtistId: "artist-1"
            }
          ])
        );
      }

      if (url === "https://api.lidarr.audio/api/v0.4/artist/artist-1") {
        return Promise.resolve(
          jsonResponse({
            id: "artist-1",
            artistname: "Stromae",
            overview: "Public overview",
            images: [{ CoverType: "Poster", Url: "https://images.example/poster.jpg" }]
          })
        );
      }
    });

    const client = new LidarrClient("http://lidarr", "test-key");
    const artist = await client.getArtistByForeignId("artist-1");

    expect(artist).toMatchObject({
      artistName: "Stromae",
      overview: "Public overview",
      images: [{ coverType: "poster", url: "https://images.example/poster.jpg" }]
    });
  });

  it("does not return unrelated albums when artist lookup results do not match the selected artist", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/v1/artist")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.includes("/api/v1/artist/mbid/artist-1")) {
        return Promise.resolve(new Response("not found", { status: 404 }));
      }

      if (url.includes("/api/v1/artist/lookup?term=Stromae")) {
        return Promise.resolve(
          jsonResponse([
            {
              artistName: "Stromae",
              foreignArtistId: "artist-1"
            }
          ])
        );
      }

      if (url.includes("/api/v1/album/lookup?term=Stromae")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: 99,
              title: "Wrong Album",
              artistName: "Someone Else",
              foreignArtistId: "artist-2"
            }
          ])
        );
      }

      if (url.endsWith("/api/v1/album")) {
        return Promise.resolve(jsonResponse([]));
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new LidarrClient("http://lidarr", "test-key");
    const albums = await client.getAlbumsByArtistForeignId("artist-1", "Stromae");

    expect(albums).toEqual([]);
  });

  it("merges tracked and lookup albums for artists already in Lidarr", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/v1/artist")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: 10,
              artistName: "Stromae",
              foreignArtistId: "artist-1"
            }
          ])
        );
      }

      if (url.includes("/api/v1/artist/mbid/artist-1")) {
        return Promise.resolve(new Response("not found", { status: 404 }));
      }

      if (url.includes("/api/v1/artist/lookup?term=Stromae")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: 10,
              artistName: "Stromae",
              foreignArtistId: "artist-1"
            }
          ])
        );
      }

      if (url.endsWith("/api/v1/album")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: 4,
              title: "Racine carree",
              foreignAlbumId: "album-1",
              artistId: 10,
              artist: {
                artistName: "Stromae",
                foreignArtistId: "artist-1"
              },
              images: [{ url: "/library-cover.jpg" }]
            }
          ])
        );
      }

      if (url.includes("/api/v1/album/lookup?term=Stromae")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: 40,
              title: "Racine carree",
              foreignAlbumId: "album-1",
              artistName: "Stromae",
              foreignArtistId: "artist-1"
            },
            {
              id: 41,
              title: "Cheese",
              foreignAlbumId: "album-2",
              artistName: "Stromae",
              foreignArtistId: "artist-1",
              images: [{ remoteUrl: "https://images.example/cheese.jpg" }]
            }
          ])
        );
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new LidarrClient("http://lidarr", "test-key");
    const albums = await client.getAlbumsByArtistForeignId("artist-1", "Stromae");

    expect(albums).toHaveLength(2);
    expect(albums).toEqual([
      expect.objectContaining({
        title: "Racine carree",
        foreignAlbumId: "album-1",
        images: [{ url: "http://lidarr/library-cover.jpg" }]
      }),
      expect.objectContaining({
        title: "Cheese",
        foreignAlbumId: "album-2",
        images: [{ remoteUrl: "https://images.example/cheese.jpg" }]
      })
    ]);
  });

  it("falls back to the public Lidarr artist discography for artist albums when local lookup is empty", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/v1/artist")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.includes("/api/v1/artist/mbid/artist-1")) {
        return Promise.resolve(new Response("not found", { status: 404 }));
      }

      if (url.includes("/api/v1/artist/lookup?term=lidarr%3Aartist-1")) {
        return Promise.resolve(
          jsonResponse([
            {
              artistName: "Stromae",
              foreignArtistId: "artist-1"
            }
          ])
        );
      }

      if (url.includes("/api/v1/album/lookup?term=Stromae")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url === "https://api.lidarr.audio/api/v0.4/artist/artist-1") {
        return Promise.resolve(
          jsonResponse({
            id: "artist-1",
            artistname: "Stromae",
            Albums: [
              { Id: "album-2", Title: "Cheese", Type: "Album" },
              { Id: "album-3", Title: "Multitude", Type: "Album" },
              { Id: "album-4", Title: "Alors on danse", Type: "Single" }
            ]
          })
        );
      }

      if (url.includes("/api/v1/album/lookup?term=lidarr%3Aalbum-2")) {
        return Promise.resolve(
          jsonResponse([
            {
              title: "Cheese",
              foreignAlbumId: "album-2",
              artistName: "Stromae",
              foreignArtistId: "artist-1",
              images: [{ remoteUrl: "https://images.example/cheese.jpg" }]
            }
          ])
        );
      }

      if (url.includes("/api/v1/album/lookup?term=lidarr%3Aalbum-3")) {
        return Promise.resolve(
          jsonResponse([
            {
              title: "Multitude",
              foreignAlbumId: "album-3",
              artistName: "Stromae",
              foreignArtistId: "artist-1"
            }
          ])
        );
      }
    });

    const client = new LidarrClient("http://lidarr", "test-key");
    const albums = await client.getAlbumsByArtistForeignId("artist-1", "Stromae");

    expect(albums).toHaveLength(2);
    expect(albums).toEqual([
      expect.objectContaining({
        title: "Cheese",
        foreignAlbumId: "album-2",
        images: [{ remoteUrl: "https://images.example/cheese.jpg" }]
      }),
      expect.objectContaining({
        title: "Multitude",
        foreignAlbumId: "album-3"
      })
    ]);
  });

  it("expands discover album results from matched artists when direct album search is empty", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/v1/artist/lookup?term=Christine")) {
        return Promise.resolve(
          jsonResponse([
            {
              artistName: "Christine and the Queens",
              foreignArtistId: "artist-7",
              images: [{ url: "/artist.jpg" }]
            }
          ])
        );
      }

      if (url.includes("/api/v1/album/lookup?term=Christine%20and%20the%20Queens")) {
        return Promise.resolve(
          jsonResponse([
            {
              title: "Chaleur Humaine",
              foreignAlbumId: "album-7",
              artistName: "Christine and the Queens",
              foreignArtistId: "artist-7",
              images: [{ url: "/album.jpg" }]
            }
          ])
        );
      }

      if (url.includes("/api/v1/album/lookup?term=Christine")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.endsWith("/api/v1/album")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.includes("/api/v1/song/lookup?term=Christine")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.includes("/api/v1/track/lookup?term=Christine")) {
        return Promise.resolve(jsonResponse([]));
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new LidarrClient("http://lidarr", "test-key");
    const results = await client.searchDiscover("Christine");

    expect(results.albums).toEqual([
      expect.objectContaining({
        title: "Chaleur Humaine",
        foreignAlbumId: "album-7",
        artistName: "Christine and the Queens",
        foreignArtistId: "artist-7",
        images: [{ url: "http://lidarr/album.jpg" }]
      })
    ]);
  });

  it("dedupes direct and artist-expanded discover album results while preserving richer metadata", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/v1/artist/lookup?term=Stro")) {
        return Promise.resolve(
          jsonResponse([
            {
              artistName: "Stromae",
              foreignArtistId: "artist-1"
            }
          ])
        );
      }

      if (url.includes("/api/v1/album/lookup?term=Stromae")) {
        return Promise.resolve(
          jsonResponse([
            {
              title: "Cheese",
              foreignAlbumId: "album-2",
              artistName: "Stromae",
              foreignArtistId: "artist-1",
              images: [{ remoteUrl: "https://images.example/cheese.jpg" }]
            },
            {
              title: "Multitude",
              foreignAlbumId: "album-3",
              artistName: "Stromae",
              foreignArtistId: "artist-1"
            }
          ])
        );
      }

      if (url.includes("/api/v1/album/lookup?term=Stro")) {
        return Promise.resolve(
          jsonResponse([
            {
              title: "Cheese",
              foreignAlbumId: "album-2",
              artistName: "Stromae",
              foreignArtistId: "artist-1"
            }
          ])
        );
      }

      if (url.endsWith("/api/v1/album")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.includes("/api/v1/song/lookup?term=Stro")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.includes("/api/v1/track/lookup?term=Stro")) {
        return Promise.resolve(jsonResponse([]));
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new LidarrClient("http://lidarr", "test-key");
    const results = await client.searchDiscover("Stro");

    expect(results.albums).toHaveLength(2);
    expect(results.albums).toEqual([
      expect.objectContaining({
        title: "Cheese",
        foreignAlbumId: "album-2",
        images: [{ remoteUrl: "https://images.example/cheese.jpg" }]
      }),
      expect.objectContaining({
        title: "Multitude",
        foreignAlbumId: "album-3"
      })
    ]);
  });

  it("hydrates sparse discover artist cards with public artist metadata", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/v1/artist/lookup?term=Stro")) {
        return Promise.resolve(
          jsonResponse([
            {
              artistName: "Stromae",
              foreignArtistId: "artist-1"
            }
          ])
        );
      }

      if (url.includes("/api/v1/album/lookup?term=Stromae")) {
        return Promise.resolve(
          jsonResponse([
            {
              title: "Multitude",
              foreignAlbumId: "album-3",
              artistName: "Stromae",
              foreignArtistId: "artist-1"
            }
          ])
        );
      }

      if (url.includes("/api/v1/album/lookup?term=Stro")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.endsWith("/api/v1/album")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.includes("/api/v1/song/lookup?term=Stro")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.includes("/api/v1/track/lookup?term=Stro")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.startsWith("https://api.lidarr.audio/api/v0.4/artist/artist-1")) {
        return Promise.resolve(
          jsonResponse({
            Id: "artist-1",
            ArtistName: "Stromae",
            Overview: "Hydrated overview",
            Images: [{ CoverType: "Poster", Url: "https://images.example/stromae-poster.jpg" }],
            Albums: []
          })
        );
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new LidarrClient("http://lidarr", "test-key");
    const results = await client.searchDiscover("Stro");

    expect(results.albums).toHaveLength(1);
    expect(results.artists[0]).toMatchObject({
      artistName: "Stromae",
      overview: "Hydrated overview",
      images: [{ coverType: "poster", url: "https://images.example/stromae-poster.jpg" }]
    });
  });

  it("splits allowed singles from albums using the active Lidarr metadata profile", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/v1/metadataprofile")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: 1,
              primaryAlbumTypes: [
                { albumType: { name: "Album" }, allowed: true },
                { albumType: { name: "Single" }, allowed: true },
                { albumType: { name: "EP" }, allowed: false }
              ],
              secondaryAlbumTypes: [
                { albumType: { name: "Studio" }, allowed: true },
                { albumType: { name: "Soundtrack" }, allowed: true }
              ],
              releaseStatuses: [
                { releaseStatus: { name: "Official" }, allowed: true }
              ]
            }
          ])
        );
      }

      if (url.includes("/api/v1/artist/lookup?term=Stromae")) {
        return Promise.resolve(
          jsonResponse([
            {
              artistName: "Stromae",
              foreignArtistId: "artist-1"
            }
          ])
        );
      }

      if (url.includes("/api/v1/album/lookup?term=Stromae")) {
        return Promise.resolve(
          jsonResponse([
            {
              title: "Multitude",
              foreignAlbumId: "album-1",
              artistName: "Stromae",
              foreignArtistId: "artist-1",
              albumType: "Album",
              secondaryTypes: [],
              releaseStatuses: ["Official"]
            },
            {
              title: "Santé",
              foreignAlbumId: "single-1",
              artistName: "Stromae",
              foreignArtistId: "artist-1",
              albumType: "Single",
              secondaryTypes: [],
              releaseStatuses: ["Official"]
            },
            {
              title: "Live Session",
              foreignAlbumId: "live-1",
              artistName: "Stromae",
              foreignArtistId: "artist-1",
              albumType: "Album",
              secondaryTypes: ["Live"],
              releaseStatuses: ["Official"]
            }
          ])
        );
      }

      if (url.endsWith("/api/v1/album")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.includes("/api/v1/song/lookup?term=Stromae")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.includes("/api/v1/track/lookup?term=Stromae")) {
        return Promise.resolve(jsonResponse([]));
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new LidarrClient("http://lidarr", "test-key");
    const results = await client.searchDiscover("Stromae", 1);

    expect(results.albums).toEqual([
      expect.objectContaining({
        title: "Multitude",
        releaseGroup: "album"
      })
    ]);
    expect(results.singles).toEqual([
      expect.objectContaining({
        title: "Santé",
        releaseGroup: "single"
      })
    ]);
  });

  it("splits artist page releases using raw Lidarr albumType payloads", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/v1/metadataprofile")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: 1,
              primaryAlbumTypes: [
                { albumType: { name: "Album" }, allowed: true },
                { albumType: { name: "Single" }, allowed: true }
              ],
              secondaryAlbumTypes: [
                { albumType: { name: "Studio" }, allowed: true }
              ],
              releaseStatuses: [
                { releaseStatus: { name: "Official" }, allowed: true }
              ]
            }
          ])
        );
      }

      if (url.endsWith("/api/v1/artist")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.includes("/api/v1/artist/mbid/artist-1")) {
        return Promise.resolve(new Response("not found", { status: 404 }));
      }

      if (url.includes("/api/v1/artist/lookup?term=lidarr%3Aartist-1")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.includes("/api/v1/artist/lookup?term=Stromae")) {
        return Promise.resolve(
          jsonResponse([
            {
              artistName: "Stromae",
              foreignArtistId: "artist-1"
            }
          ])
        );
      }

      if (url.includes("/api/v1/album/lookup?term=Stromae")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: 1,
              title: "Multitude",
              foreignAlbumId: "album-1",
              artistName: "Stromae",
              foreignArtistId: "artist-1",
              albumType: "Album",
              secondaryTypes: ["Studio"],
              releaseStatuses: ["Official"]
            },
            {
              id: 2,
              title: "Santé",
              foreignAlbumId: "single-1",
              artistName: "Stromae",
              foreignArtistId: "artist-1",
              albumType: "Single",
              secondaryTypes: [],
              releaseStatuses: ["Official"]
            }
          ])
        );
      }

      if (url.endsWith("/api/v1/album")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.startsWith("https://api.lidarr.audio/api/v0.4/artist/artist-1")) {
        return Promise.resolve(
          jsonResponse({
            Id: "artist-1",
            ArtistName: "Stromae",
            Albums: []
          })
        );
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new LidarrClient("http://lidarr", "test-key");
    const grouped = await client.getGroupedReleasesByArtistForeignId("artist-1", "Stromae", null, 1);

    expect(grouped.albums).toHaveLength(1);
    expect(grouped.albums[0]).toMatchObject({ title: "Multitude", releaseGroup: "album" });
    expect(grouped.singles).toHaveLength(1);
    expect(grouped.singles[0]).toMatchObject({ title: "Santé", releaseGroup: "single" });
  });

  it("keeps tracked singles on artist pages when album lookup results are empty", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/v1/metadataprofile")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: 1,
              primaryAlbumTypes: [
                { albumType: { name: "Album" }, allowed: true },
                { albumType: { name: "Single" }, allowed: true }
              ],
              secondaryAlbumTypes: [
                { albumType: { name: "Studio" }, allowed: true },
                { albumType: { name: "Soundtrack" }, allowed: true }
              ],
              releaseStatuses: [
                { releaseStatus: { name: "Official" }, allowed: true }
              ]
            }
          ])
        );
      }

      if (url.endsWith("/api/v1/artist")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: 7,
              artistName: "Stromae",
              foreignArtistId: "artist-1"
            }
          ])
        );
      }

      if (url.includes("/api/v1/artist/mbid/artist-1")) {
        return Promise.resolve(new Response("not found", { status: 404 }));
      }

      if (url.includes("/api/v1/artist/lookup?term=lidarr%3Aartist-1")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.includes("/api/v1/artist/lookup?term=Stromae")) {
        return Promise.resolve(
          jsonResponse([
            {
              artistName: "Stromae",
              foreignArtistId: "artist-1"
            }
          ])
        );
      }

      if (url.includes("/api/v1/album/lookup?term=Stromae")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.endsWith("/api/v1/album")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: 11,
              artistId: 7,
              title: "Multitude",
              foreignAlbumId: "album-1",
              artist: {
                artistName: "Stromae",
                foreignArtistId: "artist-1"
              },
              albumType: "Album",
              secondaryTypes: [],
              statistics: {
                trackCount: 12,
                trackFileCount: 12
              }
            },
            {
              id: 12,
              artistId: 7,
              title: "Santé",
              foreignAlbumId: "single-1",
              artist: {
                artistName: "Stromae",
                foreignArtistId: "artist-1"
              },
              albumType: "Single",
              secondaryTypes: [],
              statistics: {
                trackCount: 1,
                trackFileCount: 1
              }
            }
          ])
        );
      }

      if (url.startsWith("https://api.lidarr.audio/api/v0.4/artist/artist-1")) {
        return Promise.resolve(
          jsonResponse({
            Id: "artist-1",
            ArtistName: "Stromae",
            Albums: []
          })
        );
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new LidarrClient("http://lidarr", "test-key");
    const grouped = await client.getGroupedReleasesByArtistForeignId("artist-1", "Stromae", null, 1);

    expect(grouped.albums).toEqual([
      expect.objectContaining({ title: "Multitude", releaseGroup: "album" })
    ]);
    expect(grouped.singles).toEqual([
      expect.objectContaining({ title: "Santé", releaseGroup: "single" })
    ]);
  });

  it("keeps the full public album and single set when lookup results are incomplete", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/v1/metadataprofile")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: 1,
              primaryAlbumTypes: [
                { albumType: { name: "Album" }, allowed: true },
                { albumType: { name: "Single" }, allowed: true }
              ],
              secondaryAlbumTypes: [
                { albumType: { name: "Studio" }, allowed: true }
              ],
              releaseStatuses: [
                { releaseStatus: { name: "Official" }, allowed: true }
              ]
            }
          ])
        );
      }

      if (url.endsWith("/api/v1/artist")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.includes("/api/v1/artist/mbid/artist-u2")) {
        return Promise.resolve(new Response("not found", { status: 404 }));
      }

      if (url.includes("/api/v1/artist/lookup?term=lidarr%3Aartist-u2")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.includes("/api/v1/artist/lookup?term=U2")) {
        return Promise.resolve(
          jsonResponse([
            {
              artistName: "U2",
              foreignArtistId: "artist-u2"
            }
          ])
        );
      }

      if (url.includes("/api/v1/album/lookup?term=U2")) {
        return Promise.resolve(
          jsonResponse([
            {
              title: "Boy",
              foreignAlbumId: "album-1",
              artistName: "U2",
              foreignArtistId: "artist-u2",
              albumType: "Album",
              secondaryTypes: [],
              releaseStatuses: ["Official"]
            }
          ])
        );
      }

      if (url.endsWith("/api/v1/album")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.startsWith("https://api.lidarr.audio/api/v0.4/artist/artist-u2")) {
        return Promise.resolve(
          jsonResponse({
            Id: "artist-u2",
            ArtistName: "U2",
            Albums: [
              {
                Id: "album-1",
                Title: "Boy",
                Type: "Album",
                SecondaryTypes: [],
                ReleaseStatuses: ["Official"]
              },
              {
                Id: "album-2",
                Title: "War",
                Type: "Album",
                SecondaryTypes: [],
                ReleaseStatuses: ["Official"]
              },
              {
                Id: "single-1",
                Title: "Pride",
                Type: "Single",
                SecondaryTypes: [],
                ReleaseStatuses: ["Official"]
              },
              {
                Id: "single-2",
                Title: "One",
                Type: "Single",
                SecondaryTypes: [],
                ReleaseStatuses: ["Official"]
              }
            ]
          })
        );
      }

      if (url.includes("/api/v1/album/lookup?term=lidarr%3A")) {
        return Promise.resolve(jsonResponse([]));
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new LidarrClient("http://lidarr", "test-key");
    const grouped = await client.getGroupedReleasesByArtistForeignId("artist-u2", "U2", null, 1);

    expect(grouped.albums.map((album) => album.title)).toEqual(["Boy", "War"]);
    expect(grouped.singles.map((single) => single.title)).toEqual(["Pride", "One"]);
  });

  it("filters discover album results to the matched artist identity for artist-style searches", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/v1/artist/lookup?term=U2")) {
        return Promise.resolve(
          jsonResponse([
            {
              artistName: "U2",
              foreignArtistId: "artist-u2"
            }
          ])
        );
      }

      if (url.includes("/api/v1/album/lookup?term=U2")) {
        return Promise.resolve(
          jsonResponse([
            {
              title: "The Joshua Tree",
              foreignAlbumId: "album-u2-1",
              artistName: "U2",
              foreignArtistId: "artist-u2"
            },
            {
              title: "Covered by U2",
              foreignAlbumId: "album-other-1",
              artistName: "Various Artists",
              foreignArtistId: "artist-other"
            }
          ])
        );
      }

      if (url.endsWith("/api/v1/album")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.includes("/api/v1/song/lookup?term=U2")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.includes("/api/v1/track/lookup?term=U2")) {
        return Promise.resolve(jsonResponse([]));
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new LidarrClient("http://lidarr", "test-key");
    const results = await client.searchDiscover("U2");

    expect(results.albums).toEqual([
      expect.objectContaining({
        title: "The Joshua Tree",
        foreignAlbumId: "album-u2-1",
        artistName: "U2",
        foreignArtistId: "artist-u2"
      })
    ]);
  });

  it("falls back to library albums when discover album lookup returns no matches", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/v1/artist/lookup?term=Racine")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.includes("/api/v1/album/lookup?term=Racine")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.endsWith("/api/v1/album")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: 4,
              title: "Racine carree",
              foreignAlbumId: "album-1",
              artist: {
                artistName: "Stromae",
                foreignArtistId: "artist-1"
              },
              images: [{ remoteUrl: "https://images.example/cover.jpg" }]
            }
          ])
        );
      }

      if (url.includes("/api/v1/song/lookup?term=Racine")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.includes("/api/v1/track/lookup?term=Racine")) {
        return Promise.resolve(jsonResponse([]));
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new LidarrClient("http://lidarr", "test-key");
    const results = await client.searchDiscover("Racine");

    expect(results.albums).toHaveLength(1);
    expect(results.albums[0]).toMatchObject({
      title: "Racine carree",
      artistName: "Stromae",
      foreignAlbumId: "album-1"
    });
  });

  it("counts track files by album id for availability checks", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/v1/trackfile?albumId=4")) {
        return Promise.resolve(jsonResponse([{ id: 1 }, { id: 2 }]));
      }

      if (url.includes("/api/v1/trackfile?albumId=5")) {
        return Promise.resolve(jsonResponse([]));
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new LidarrClient("http://lidarr", "test-key");
    const counts = await client.getAlbumFileCounts([4, 5, 4]);

    expect(counts).toEqual({
      4: 2,
      5: 0
    });
  });

  it("treats availability as a full album instead of any matching track file", () => {
    const client = new LidarrClient("http://lidarr", "test-key");

    expect(
      client.isAlbumFullyAvailable({
        statistics: {
          trackFileCount: 8,
          trackCount: 8,
          percentOfTracks: 100
        }
      })
    ).toBe(true);

    expect(
      client.isAlbumFullyAvailable({
        statistics: {
          trackFileCount: 1,
          trackCount: 14,
          percentOfTracks: 7.14
        }
      })
    ).toBe(false);
  });

  it("hydrates track results from the library track endpoint even when Lidarr omits artist and album fields", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/v1/album")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: 4,
              title: "Racine carree",
              foreignAlbumId: "album-1",
              artist: {
                artistName: "Stromae",
                foreignArtistId: "artist-1"
              }
            }
          ])
        );
      }

      if (url.includes("/api/v1/trackfile?albumId=4")) {
        return Promise.resolve(jsonResponse([{ path: "/music/file.flac" }]));
      }

      if (url.includes("/api/v1/track?albumId=4")) {
        return Promise.resolve(
          jsonResponse([
            {
              title: "Ta fete",
              trackNumber: 1
            }
          ])
        );
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new LidarrClient("http://lidarr", "test-key");
    const tracks = await client.getAlbumTracks("album-1");

    expect(tracks).toEqual([
      expect.objectContaining({
        title: "Ta fete",
        artistName: "Stromae",
        albumTitle: "Racine carree"
      })
    ]);
  });

  it("falls back to lookup song results for albums not yet tracked", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/v1/album")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.includes("/api/v1/album/lookup?term=album-2")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.includes("/api/v1/song/lookup?term=album-2")) {
        return Promise.resolve(
          jsonResponse([
            {
              title: "Alors on danse",
              artistName: "Stromae",
              albumTitle: "Cheese",
              foreignAlbumId: "album-2",
              trackNumber: 1
            }
          ])
        );
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new LidarrClient("http://lidarr", "test-key");
    const tracks = await client.getAlbumTracks("album-2");

    expect(tracks).toEqual([
      expect.objectContaining({
        title: "Alors on danse",
        foreignAlbumId: "album-2",
        trackNumber: 1
      })
    ]);
  });

  it("hydrates untracked album details and tracks from the exact Lidarr album lookup payload", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/v1/album")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.includes("/api/v1/album/lookup?term=lidarr%3Aalbum-9")) {
        return Promise.resolve(
          jsonResponse({
            id: 99,
            title: "My Untracked Album",
            foreignAlbumId: "album-9",
            artist: {
              artistName: "Untracked Artist",
              foreignArtistId: "artist-9"
            },
            images: [{ CoverType: "Cover", Url: "https://images.example/untracked.jpg" }],
            songs: [
              {
                title: "Opening Track",
                trackNumber: 1,
                duration: 123000,
                foreignTrackId: "track-1"
              }
            ]
          })
        );
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new LidarrClient("http://lidarr", "test-key");
    const album = await client.getAlbumByForeignId("album-9");
    const tracks = await client.getAlbumTracks("album-9");

    expect(album).toMatchObject({
      title: "My Untracked Album",
      foreignAlbumId: "album-9",
      artistName: "Untracked Artist",
      foreignArtistId: "artist-9",
      images: [{ coverType: "cover", url: "https://images.example/untracked.jpg" }]
    });
    expect(tracks).toEqual([
      expect.objectContaining({
        title: "Opening Track",
        albumTitle: "My Untracked Album",
        artistName: "Untracked Artist",
        foreignAlbumId: "album-9",
        trackNumber: 1
      })
    ]);
  });

  it("hydrates untracked album tracks from releases in the exact Lidarr album payload", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/v1/album")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.includes("/api/v1/album/lookup?term=lidarr%3Aalbum-release")) {
        return Promise.resolve(
          jsonResponse({
            id: 109,
            title: "Balance",
            foreignAlbumId: "album-release",
            artist: {
              artistName: "Van Halen",
              foreignArtistId: "artist-vh"
            },
            releases: [
              {
                Tracks: [
                  {
                    Title: "The Seventh Seal",
                    TrackNumber: 1,
                    Duration: 334000,
                    ForeignTrackId: "track-vh-1"
                  },
                  {
                    Title: "Can't Stop Lovin' You",
                    TrackNumber: 2,
                    Duration: 256000,
                    ForeignTrackId: "track-vh-2"
                  }
                ]
              }
            ]
          })
        );
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new LidarrClient("http://lidarr", "test-key");
    const tracks = await client.getAlbumTracks("album-release");

    expect(tracks).toEqual([
      expect.objectContaining({
        title: "The Seventh Seal",
        albumTitle: "Balance",
        artistName: "Van Halen",
        foreignAlbumId: "album-release",
        trackNumber: 1
      }),
      expect.objectContaining({
        title: "Can't Stop Lovin' You",
        albumTitle: "Balance",
        artistName: "Van Halen",
        foreignAlbumId: "album-release",
        trackNumber: 2
      })
    ]);
  });

  it("hydrates untracked album tracks from public payloads that use TrackName and TrackPosition", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/v1/album")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.includes("/api/v1/album/lookup?term=lidarr%3Aalbum-public-trackname")) {
        return Promise.resolve(
          jsonResponse({
            id: 121,
            title: "War",
            foreignAlbumId: "album-public-trackname",
            artist: {
              artistName: "U2",
              foreignArtistId: "artist-u2"
            }
          })
        );
      }

      if (url.includes("/api/v1/song/lookup?term=War")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.includes("/api/v1/song/lookup?term=album-public-trackname")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.includes("/api/v1/album/lookup?term=War")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.includes("/api/v1/album/lookup?term=album-public-trackname")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.startsWith("https://api.lidarr.audio/api/v0.4/album/album-public-trackname")) {
        return Promise.resolve(
          jsonResponse({
            Id: "album-public-trackname",
            Title: "War",
            ArtistName: "U2",
            ForeignArtistId: "artist-u2",
            Releases: [
              {
                Media: [
                  {
                    Tracks: [
                      {
                        TrackName: "Sunday Bloody Sunday",
                        TrackPosition: 1,
                        DurationMs: 278000,
                        RecordingId: "rec-1"
                      }
                    ]
                  }
                ]
              }
            ]
          })
        );
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new LidarrClient("http://lidarr", "test-key");
    const tracks = await client.getAlbumTracks("album-public-trackname");

    expect(tracks).toEqual([
      expect.objectContaining({
        title: "Sunday Bloody Sunday",
        albumTitle: "War",
        artistName: "U2",
        foreignAlbumId: "album-public-trackname",
        trackNumber: 1
      })
    ]);
  });

  it("falls back to the public album payload for untracked album tracks", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/v1/album")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.includes("/api/v1/album/lookup?term=lidarr%3Aalbum-public")) {
        return Promise.resolve(
          jsonResponse({
            id: 120,
            title: "Public Album",
            foreignAlbumId: "album-public",
            artist: {
              artistName: "Lookup Artist",
              foreignArtistId: "artist-public"
            }
          })
        );
      }

      if (url.includes("/api/v1/song/lookup?term=Public%20Album")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.includes("/api/v1/song/lookup?term=album-public")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.includes("/api/v1/album/lookup?term=Public%20Album")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.includes("/api/v1/album/lookup?term=album-public")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.startsWith("https://api.lidarr.audio/api/v0.4/album/album-public")) {
        return Promise.resolve(
          jsonResponse({
            Id: "album-public",
            Title: "Public Album",
            ArtistName: "Lookup Artist",
            ForeignArtistId: "artist-public",
            Releases: [
              {
                Tracks: [
                  {
                    Title: "Fallback Track",
                    TrackNumber: 1,
                    Duration: 222000,
                    ForeignTrackId: "fallback-1"
                  }
                ]
              }
            ]
          })
        );
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new LidarrClient("http://lidarr", "test-key");
    const tracks = await client.getAlbumTracks("album-public");

    expect(tracks).toEqual([
      expect.objectContaining({
        title: "Fallback Track",
        albumTitle: "Public Album",
        artistName: "Lookup Artist",
        foreignAlbumId: "album-public",
        trackNumber: 1
      })
    ]);
  });

  it("hydrates untracked album tracks from album lookup search payload arrays when artist context is available", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/v1/album")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.includes("/api/v1/album/lookup?term=lidarr%3Aalbum-array")) {
        return Promise.resolve(
          jsonResponse({
            id: 150,
            title: "War",
            foreignAlbumId: "album-array",
            artist: {
              artistName: "U2",
              foreignArtistId: "artist-u2"
            }
          })
        );
      }

      if (url.includes("/api/v1/song/lookup?term=U2%20War")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.includes("/api/v1/song/lookup?term=War")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.includes("/api/v1/song/lookup?term=album-array")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.includes("/api/v1/album/lookup?term=U2%20War")) {
        return Promise.resolve(
          jsonResponse([
            {
              title: "War",
              foreignAlbumId: "album-array",
              artist: {
                artistName: "U2",
                foreignArtistId: "artist-u2"
              },
              Releases: [
                {
                  Media: [
                    {
                      Tracks: [
                        {
                          Title: "Sunday Bloody Sunday",
                          TrackNumber: 1,
                          ForeignTrackId: "track-u2-1"
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ])
        );
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new LidarrClient("http://lidarr", "test-key");
    const tracks = await client.getAlbumTracks("album-array", "U2");

    expect(tracks).toEqual([
      expect.objectContaining({
        title: "Sunday Bloody Sunday",
        artistName: "U2",
        albumTitle: "War",
        foreignAlbumId: "album-array",
        trackNumber: 1
      })
    ]);
  });

  it("overrides invalid lookup artist metadata when adding an untracked album", async () => {
    let postedBody: Record<string, unknown> | null = null;

    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/api/v1/album/lookup?term=lidarr%3Aalbum-10")) {
        return Promise.resolve(
          jsonResponse({
            title: "Balance",
            foreignAlbumId: "album-10",
            artist: {
              id: 0,
              artistName: "Van Halen",
              foreignArtistId: "artist-10",
              qualityProfileId: 0,
              metadataProfileId: 0,
              rootFolderPath: null
            }
          })
        );
      }

      if (url.endsWith("/api/v1/album") && init?.method === "POST") {
        postedBody = JSON.parse(String(init.body)) as Record<string, unknown>;
        return Promise.resolve(jsonResponse({ id: 15, title: "Balance" }));
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new LidarrClient("http://lidarr", "test-key");
    await client.addAlbum({
      albumTitle: "Balance",
      artistName: "Van Halen",
      foreignArtistId: "artist-10",
      foreignAlbumId: "album-10",
      artistId: 5,
      qualityProfileId: 7,
      metadataProfileId: 3,
      rootFolderPath: "/music"
    });

    expect(postedBody).toMatchObject({
      artistId: 5,
      monitored: true,
      artist: {
        id: 5,
        artistName: "Van Halen",
        foreignArtistId: "artist-10",
        qualityProfileId: 7,
        metadataProfileId: 3,
        rootFolderPath: "/music"
      }
    });
  });

  it("returns the existing album when Lidarr reports a foreignAlbumId conflict during add", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/api/v1/album/lookup?term=lidarr%3Aalbum-conflict")) {
        return Promise.resolve(
          jsonResponse({
            title: "Balance",
            foreignAlbumId: "album-conflict",
            artist: {
              artistName: "Van Halen",
              foreignArtistId: "artist-10"
            }
          })
        );
      }

      if (url.endsWith("/api/v1/album") && init?.method === "POST") {
        return Promise.resolve(
          new Response("constraint failed\nUNIQUE constraint failed: Albums.ForeignAlbumId", {
            status: 409
          })
        );
      }

      if (url.endsWith("/api/v1/album")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: 44,
              title: "Balance",
              foreignAlbumId: "album-conflict",
              artist: {
                artistName: "Van Halen",
                foreignArtistId: "artist-10"
              }
            }
          ])
        );
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new LidarrClient("http://lidarr", "test-key");
    const album = await client.addAlbum({
      albumTitle: "Balance",
      artistName: "Van Halen",
      foreignArtistId: "artist-10",
      foreignAlbumId: "album-conflict",
      qualityProfileId: 7,
      metadataProfileId: 3,
      rootFolderPath: "/music"
    });

    expect(album).toMatchObject({
      id: 44,
      title: "Balance",
      foreignAlbumId: "album-conflict"
    });
  });

  it("uses Lidarr defaults when explicit add defaults are missing", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/v1/rootfolder")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: 1,
              path: "/data/media/music",
              accessible: true,
              defaultMetadataProfileId: 1,
              defaultQualityProfileId: 3
            }
          ])
        );
      }

      if (url.endsWith("/api/v1/qualityprofile")) {
        return Promise.resolve(
          jsonResponse([
            { id: 3, name: "Any" }
          ])
        );
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new LidarrClient("http://lidarr", "test-key");
    const defaults = await client.getEffectiveAddDefaults();

    expect(defaults).toEqual({
      rootFolderPath: "/data/media/music",
      qualityProfileId: 3,
      metadataProfileId: 1
    });
  });

  it("uses Lidarr default metadata profile rules when no profile id is configured", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/v1/rootfolder")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: 1,
              path: "/data/media/music",
              accessible: true,
              defaultMetadataProfileId: 1,
              defaultQualityProfileId: 3
            }
          ])
        );
      }

      if (url.endsWith("/api/v1/qualityprofile")) {
        return Promise.resolve(
          jsonResponse([
            { id: 3, name: "Any" }
          ])
        );
      }

      if (url.endsWith("/api/v1/metadataprofile")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: 1,
              primaryAlbumTypes: [
                { albumType: { name: "Album" }, allowed: true },
                { albumType: { name: "Single" }, allowed: true }
              ],
              secondaryAlbumTypes: [
                { albumType: { name: "Studio" }, allowed: true }
              ],
              releaseStatuses: [
                { releaseStatus: { name: "Official" }, allowed: true }
              ]
            }
          ])
        );
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new LidarrClient("http://lidarr", "test-key");
    const rules = await client.getReleaseFilterRules();

    expect(rules.allowedPrimaryTypes.has("album")).toBe(true);
    expect(rules.allowedPrimaryTypes.has("single")).toBe(true);
  });

  it("filters public artist albums to official primary albums only", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/v1/artist")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.includes("/api/v1/artist/mbid/artist-van")) {
        return Promise.resolve(new Response("not found", { status: 404 }));
      }

      if (url.includes("/api/v1/artist/lookup?term=lidarr%3Aartist-van")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.includes("/api/v1/artist/lookup?term=Van%20Halen")) {
        return Promise.resolve(
          jsonResponse([
            {
              artistName: "Van Halen",
              foreignArtistId: "artist-van"
            }
          ])
        );
      }

      if (url.includes("/api/v1/album/lookup?term=Van%20Halen")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.includes("/api/v1/album")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.startsWith("https://api.lidarr.audio/api/v0.4/artist/artist-van")) {
        return Promise.resolve(
          jsonResponse({
            Id: "artist-van",
            ArtistName: "Van Halen",
            Albums: [
              {
                Id: "album-studio",
                Title: "Balance",
                Type: "Album",
                SecondaryTypes: [],
                ReleaseStatuses: ["Official"]
              },
              {
                Id: "album-live",
                Title: "Live in Dallas",
                Type: "Album",
                SecondaryTypes: ["Live"],
                ReleaseStatuses: ["Official"]
              },
              {
                Id: "album-ep",
                Title: "Promo EP",
                Type: "EP",
                SecondaryTypes: [],
                ReleaseStatuses: ["Official"]
              },
              {
                Id: "album-bootleg",
                Title: "Unofficial Sessions",
                Type: "Album",
                SecondaryTypes: [],
                ReleaseStatuses: ["Bootleg"]
              }
            ]
          })
        );
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new LidarrClient("http://lidarr", "test-key");
    const albums = await client.getAlbumsByArtistForeignId("artist-van", "Van Halen");

    expect(albums).toEqual([
      expect.objectContaining({
        title: "Balance",
        foreignAlbumId: "album-studio",
        artistName: "Van Halen"
      })
    ]);
  });

  it("keeps the full public artist album set when lookup results are incomplete", async () => {
    const publicAlbums = Array.from({ length: 15 }, (_, index) => ({
      Id: `album-${index + 1}`,
      Title: `Album ${index + 1}`,
      Type: "Album",
      SecondaryTypes: [],
      ReleaseStatuses: ["Official"]
    }));

    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/v1/metadataprofile")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: 1,
              primaryAlbumTypes: [{ albumType: { name: "Album" }, allowed: true }],
              secondaryAlbumTypes: [{ albumType: { name: "Studio" }, allowed: true }],
              releaseStatuses: [{ releaseStatus: { name: "Official" }, allowed: true }]
            }
          ])
        );
      }

      if (url.endsWith("/api/v1/artist")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.includes("/api/v1/artist/mbid/artist-u2")) {
        return Promise.resolve(new Response("not found", { status: 404 }));
      }

      if (url.includes("/api/v1/artist/lookup?term=lidarr%3Aartist-u2")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.includes("/api/v1/artist/lookup?term=U2")) {
        return Promise.resolve(
          jsonResponse([
            {
              artistName: "U2",
              foreignArtistId: "artist-u2"
            }
          ])
        );
      }

      if (url.includes("/api/v1/album/lookup?term=U2")) {
        return Promise.resolve(
          jsonResponse(
            publicAlbums.slice(0, 8).map((album) => ({
              id: 0,
              title: album.Title,
              foreignAlbumId: album.Id,
              artistName: "U2",
              foreignArtistId: "artist-u2",
              albumType: "Album",
              secondaryTypes: [],
              releaseStatuses: ["Official"]
            }))
          )
        );
      }

      if (url.endsWith("/api/v1/album")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.startsWith("https://api.lidarr.audio/api/v0.4/artist/artist-u2")) {
        return Promise.resolve(
          jsonResponse({
            Id: "artist-u2",
            ArtistName: "U2",
            Albums: publicAlbums
          })
        );
      }

      if (url.includes("/api/v1/album/lookup?term=lidarr%3Aalbum-")) {
        return Promise.resolve(jsonResponse([]));
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new LidarrClient("http://lidarr", "test-key");
    const albums = await client.getAlbumsByArtistForeignId("artist-u2", "U2", null, 1);

    expect(albums).toHaveLength(15);
  });

  it("hydrates artist-page album images from public album metadata when exact lookup is sparse", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/v1/artist")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: 10,
              artistName: "U2",
              foreignArtistId: "artist-u2"
            }
          ])
        );
      }

      if (url.includes("/api/v1/artist/mbid/artist-u2")) {
        return Promise.resolve(new Response("not found", { status: 404 }));
      }

      if (url.includes("/api/v1/artist/lookup?term=lidarr%3Aartist-u2")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.includes("/api/v1/artist/lookup?term=U2")) {
        return Promise.resolve(
          jsonResponse([
            {
              artistName: "U2",
              foreignArtistId: "artist-u2"
            }
          ])
        );
      }

      if (url.endsWith("/api/v1/album")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.includes("/api/v1/album/lookup?term=U2")) {
        return Promise.resolve(
          jsonResponse([
            {
              title: "The Joshua Tree",
              foreignAlbumId: "album-joshua",
              artistName: "U2",
              foreignArtistId: "artist-u2",
              albumType: "Album",
              secondaryTypes: [],
              releaseStatuses: ["Official"]
            }
          ])
        );
      }

      if (url.includes("/api/v1/album/lookup?term=lidarr%3Aalbum-joshua")) {
        return Promise.resolve(
          jsonResponse({
            title: "The Joshua Tree",
            foreignAlbumId: "album-joshua",
            artist: {
              artistName: "U2",
              foreignArtistId: "artist-u2"
            }
          })
        );
      }

      if (url.includes("/api/v1/album/lookup?term=U2%20The%20Joshua%20Tree")) {
        return Promise.resolve(
          jsonResponse([
            {
              title: "The Joshua Tree",
              foreignAlbumId: "album-joshua",
              artistName: "U2",
              foreignArtistId: "artist-u2",
              images: [{ coverType: "cover", remoteUrl: "https://images.example/joshua.jpg" }]
            }
          ])
        );
      }

      if (url.startsWith("https://api.lidarr.audio/api/v0.4/artist/artist-u2")) {
        return Promise.resolve(
          jsonResponse({
            Id: "artist-u2",
            ArtistName: "U2",
            Albums: [
              {
                Id: "album-joshua",
                Title: "The Joshua Tree",
                Type: "Album",
                SecondaryTypes: [],
                ReleaseStatuses: ["Official"]
              }
            ]
          })
        );
      }

      if (url.startsWith("https://api.lidarr.audio/api/v0.4/album/album-joshua")) {
        return Promise.resolve(
          jsonResponse({
            Id: "album-joshua",
            ArtistName: "U2",
            Title: "The Joshua Tree",
            Images: [{ CoverType: "Cover", RemoteUrl: "https://images.example/joshua.jpg" }]
          })
        );
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new LidarrClient("http://lidarr", "test-key");
    const grouped = await client.getGroupedReleasesByArtistForeignId("artist-u2", "U2");

    expect(grouped.albums).toEqual([
      expect.objectContaining({
        title: "The Joshua Tree",
        images: [{ coverType: "cover", remoteUrl: "https://images.example/joshua.jpg" }]
      })
    ]);
  });

  it("posts an AlbumSearch command for newly tracked albums", async () => {
    let postedBody: Record<string, unknown> | null = null;

    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/api/v1/command") && init?.method === "POST") {
        postedBody = JSON.parse(String(init.body)) as Record<string, unknown>;
        return Promise.resolve(jsonResponse({ id: 1, name: "AlbumSearch" }));
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new LidarrClient("http://lidarr", "test-key");
    await client.triggerAlbumSearch([17, 17, 23]);

    expect(postedBody).toEqual({
      name: "AlbumSearch",
      albumIds: [17, 23]
    });
  });

  it("marks the selected Lidarr albums as monitored", async () => {
    let postedBody: Record<string, unknown> | null = null;

    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/api/v1/album/monitor") && init?.method === "PUT") {
        postedBody = JSON.parse(String(init.body)) as Record<string, unknown>;
        return Promise.resolve(jsonResponse({}));
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new LidarrClient("http://lidarr", "test-key");
    await client.setAlbumsMonitored([17, 17, 23], true);

    expect(postedBody).toEqual({
      albumIds: [17, 23],
      monitored: true
    });
  });
});
