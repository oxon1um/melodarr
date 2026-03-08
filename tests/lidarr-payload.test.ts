import { describe, expect, it } from "vitest";
import { buildLidarrArtistPayload } from "../lib/lidarr/payload";

describe("buildLidarrArtistPayload", () => {
  it("builds monitored payload with defaults", () => {
    const payload = buildLidarrArtistPayload({
      artistName: "Daft Punk",
      foreignArtistId: "cc197bad-dc9c-440d-a5b5-d52ba2e14234",
      qualityProfileId: 1,
      rootFolderPath: "/music",
      monitorMode: "all",
      metadataProfileId: 1
    });

    expect(payload.artistName).toBe("Daft Punk");
    expect(payload.monitored).toBe(true);
    expect(payload.addOptions.monitor).toBe("all");
  });
});
