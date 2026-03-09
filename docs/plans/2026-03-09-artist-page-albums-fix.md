# Artist Page Albums Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix artist page to display albums by matching on `artistId` instead of `foreignArtistId`, and fix cover image URLs to use absolute paths.

**Architecture:**
- Lidarr albums have `artistId` (internal Lidarr ID like `2`) but NOT `foreignArtistId` (which is null)
- Artist lookup returns artist with `id` field (internal Lidarr ID)
- Must match albums by `artistId` and artists by their internal `id`, not foreign IDs
- Cover images are relative URLs that need the Lidarr base URL prepended

**Tech Stack:** TypeScript, Next.js API routes, Lidarr API

---

### Task 1: Fix album matching to use artistId

**Files:**
- Modify: `lib/lidarr/client.ts`

**Context from logs:**
```
[lidarr] getAlbumsByArtistForeignId - all albums: 18
[lidarr] getAlbumsByArtistForeignId - filtered by foreignArtistId: 0
```

Albums have `artistId: 2` (Lidarr's internal ID), not `foreignArtistId`.

**Step 1: Write failing test**

```typescript
// tests/lidarr-albums.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch
global.fetch = vi.fn();

describe('getAlbumsByArtistForeignId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should match albums by artistId when foreignArtistId is null', async () => {
    const { LidarrClient } = await import('@/lib/lidarr/client');
    const lidarr = new LidarrClient('http://lidarr:8686', 'test-key');

    // Mock: artist with internal id = 2
    // Mock: albums have artistId = 2 but foreignArtistId = null
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 2, foreignArtistId: 'abc-123', artistName: 'Test Artist', overview: 'Test desc' }]
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: 1, artistId: 2, foreignArtistId: null, title: 'Album 1' },  // artistId matches
          { id: 2, artistId: 3, foreignArtistId: null, title: 'Album 2' }   // different artist
        ]
      });

    const albums = await lidarr.getAlbumsByArtistForeignId('abc-123');
    expect(albums).toHaveLength(1);
    expect(albums[0].title).toBe('Album 1');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL - albums array is empty

**Step 3: Fix getAlbumsByArtistForeignId to use artistId matching**

In `lib/lidarr/client.ts`, find the `getAlbumsByArtistForeignId` method and change it to:
1. First get the artist's internal `id` from the artist lookup
2. Filter albums by `artistId` (internal Lidarr ID) instead of `foreignArtistId`

```typescript
async getAlbumsByArtistForeignId(foreignArtistId: string): Promise<LidarrArtistAlbum[]> {
  // First, get the artist's internal ID
  const artist = await this.getArtistByForeignId(foreignArtistId);
  const artistInternalId = artist?.id;

  if (!artistInternalId) {
    // Fallback: try filtering by foreignArtistId (may work for some IDs)
    const allAlbums = await this.tryRequest<LidarrArtistAlbum[]>("/api/v1/album");
    if (allAlbums && allAlbums.length > 0) {
      const filtered = allAlbums.filter((album) => album.foreignArtistId === foreignArtistId);
      if (filtered.length > 0) return filtered;
    }
    return [];
  }

  // Get all albums and filter by internal artistId
  const allAlbums = await this.tryRequest<LidarrArtistAlbum[]>("/api/v1/album");
  if (this.debug) console.log("[lidarr] getAlbumsByArtistForeignId - all albums:", allAlbums?.length ?? 0);

  if (allAlbums && allAlbums.length > 0) {
    const filtered = allAlbums.filter((album) => album.artistId === artistInternalId);
    if (this.debug) console.log("[lidarr] getAlbumsByArtistForeignId - filtered by artistId:", filtered.length);
    if (filtered.length > 0) return filtered;
  }

  // Fallback: try search
  const encoded = encodeURIComponent(foreignArtistId);
  const searchAlbums = await this.tryRequest<LidarrArtistAlbum[]>(`/api/v1/album/lookup?term=${encoded}`);

  if (searchAlbums && searchAlbums.length > 0) {
    // Filter by internal artistId from search results
    const matching = searchAlbums.filter((album) => album.artistId === artistInternalId);
    if (matching.length > 0) return matching;
    return searchAlbums;
  }

  return [];
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/lidarr/client.ts tests/lidarr-albums.test.ts
git commit -m "fix: match albums by artistId instead of foreignArtistId"
```

---

### Task 2: Fix cover image URLs to use absolute paths

**Files:**
- Modify: `lib/lidarr/client.ts`

**Context from logs:**
```
[ERROR] Failed to load resource: the server responded with 404 Not Found
http://localhost:30000/config/MediaCover/2/poster.jpeg
```

Images have relative URLs like `/config/MediaCover/2/poster.jpeg` - need to prepend Lidarr base URL.

**Step 1: Write failing test**

Add to existing test:
```typescript
it('should return cover image URLs with absolute paths', async () => {
  const { LidarrClient } = await import('@/lib/lidarr/client');
  const lidarr = new LidarrClient('http://lidarr:8686', 'test-key');

  (global.fetch as ReturnType<typeof vi.fn>)
    .mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: 2, foreignArtistId: 'abc-123', artistName: 'Test Artist' }]
    });

  const artist = await lidarr.getArtistByForeignId('abc-123');
  const imageUrl = artist?.images?.[0]?.url;

  // Should be absolute URL
  expect(imageUrl).toMatch(/^http/);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL - image URL is relative

**Step 3: Fix image URL to be absolute**

In `lib/lidarr/client.ts`, add a helper method and update the return data:

```typescript
private makeImageUrl(relativePath: string | undefined): string | undefined {
  if (!relativePath) return undefined;
  if (relativePath.startsWith('http')) return relativePath;
  // Prepend Lidarr base URL
  return `${this.baseUrl}${relativePath}`;
}
```

Then update the `getArtistByForeignId` method to transform image URLs:

```typescript
// In getArtistByForeignId, after getting the artist:
if (match && match.images) {
  match.images = match.images.map(img => ({
    ...img,
    url: this.makeImageUrl(img.url),
    remoteUrl: this.makeImageUrl(img.remoteUrl)
  }));
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/lidarr/client.ts
git commit - fix: convert relative image URLs to absolute paths"
```

---

### Task 3: Verify fix with local Docker testing

**Step 1: Rebuild and restart Docker**

```bash
cd /Users/jacob/Library/Mobile Documents/com~apple~CloudDocs/DEV/melodarr
docker compose -f docker-compose.local.yml build app
docker compose -f docker-compose.local.yml up -d
```

**Step 2: Test in browser**

1. Navigate to http://localhost:30000
2. Search for "Stromae"
3. Click on Stromae artist
4. Verify:
   - Albums section shows albums (e.g., "Racine carrée", "Multitude")
   - Cover image loads correctly

**Step 3: Commit**

```bash
git add -A
git commit - "fix: verify artist page albums display correctly"
```
