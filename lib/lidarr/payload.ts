export type BuildLidarrPayloadInput = {
  artistName: string;
  foreignArtistId?: string;
  qualityProfileId: number;
  rootFolderPath: string;
  monitorMode: string;
  metadataProfileId?: number | null;
};

export const buildLidarrArtistPayload = (input: BuildLidarrPayloadInput) => {
  return {
    artistName: input.artistName,
    foreignArtistId: input.foreignArtistId,
    qualityProfileId: input.qualityProfileId,
    metadataProfileId: input.metadataProfileId ?? undefined,
    rootFolderPath: input.rootFolderPath,
    monitored: true,
    addOptions: {
      monitor: input.monitorMode,
      searchForMissingAlbums: true
    }
  };
};
