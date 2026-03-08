import { RequestStatus, RequestType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { LidarrClient } from "@/lib/lidarr/client";
import { getRuntimeConfig } from "@/lib/settings/store";

export type CreateArtistRequestInput = {
  requestedById: string;
  artistName: string;
  foreignArtistId?: string;
  mbid?: string;
};

export type CreateAlbumRequestInput = {
  requestedById: string;
  artistName: string;
  albumTitle: string;
  foreignArtistId?: string;
  foreignAlbumId?: string;
};

const ACTIVE_STATUSES: RequestStatus[] = [
  RequestStatus.PENDING,
  RequestStatus.APPROVED,
  RequestStatus.SUBMITTED,
  RequestStatus.ALREADY_EXISTS
];

const getLidarrClientOrThrow = async () => {
  const config = await getRuntimeConfig();
  if (!config.lidarrUrl || !config.lidarrApiKey) {
    throw new Error("Lidarr is not configured");
  }

  return {
    client: new LidarrClient(config.lidarrUrl, config.lidarrApiKey),
    config
  };
};

const hasDuplicateArtistRequest = async (foreignArtistId?: string) => {
  if (!foreignArtistId) return null;

  return prisma.request.findFirst({
    where: {
      requestType: RequestType.ARTIST,
      foreignArtistId,
      status: {
        in: ACTIVE_STATUSES
      }
    }
  });
};

const hasDuplicateAlbumRequest = async (input: {
  foreignAlbumId?: string;
  artistName: string;
  albumTitle: string;
}) => {
  if (input.foreignAlbumId) {
    return prisma.request.findFirst({
      where: {
        requestType: RequestType.ALBUM,
        foreignAlbumId: input.foreignAlbumId,
        status: {
          in: ACTIVE_STATUSES
        }
      }
    });
  }

  return prisma.request.findFirst({
    where: {
      requestType: RequestType.ALBUM,
      artistName: input.artistName,
      albumTitle: input.albumTitle,
      status: {
        in: ACTIVE_STATUSES
      }
    }
  });
};

const submitArtistToLidarr = async (input: {
  artistName: string;
  foreignArtistId?: string;
  mbid?: string;
}) => {
  const { client, config } = await getLidarrClientOrThrow();

  if (!config.lidarrRootFolder || !config.lidarrQualityProfileId) {
    throw new Error("Lidarr root folder and quality profile are required");
  }

  if (input.foreignArtistId) {
    const existing = await client.getExistingArtistByForeignId(input.foreignArtistId);
    if (existing) {
      return { exists: true, lidarrArtistId: existing.id, payload: existing };
    }
  }

  const created = await client.addArtist({
    artistName: input.artistName,
    foreignArtistId: input.foreignArtistId,
    mbid: input.mbid,
    qualityProfileId: config.lidarrQualityProfileId,
    metadataProfileId: config.lidarrMetadataProfileId ?? undefined,
    rootFolderPath: config.lidarrRootFolder,
    monitorMode: config.lidarrMonitorMode
  });

  return { exists: false, lidarrArtistId: created.id, payload: created };
};

const submitAlbumToLidarr = async (input: {
  artistName: string;
  albumTitle: string;
  foreignArtistId?: string;
  foreignAlbumId?: string;
}) => {
  const { client, config } = await getLidarrClientOrThrow();

  if (input.foreignAlbumId) {
    const existingAlbum = await client.getExistingAlbumByForeignId(input.foreignAlbumId);
    if (existingAlbum) {
      return { exists: true, lidarrAlbumId: existingAlbum.id, payload: existingAlbum };
    }
  }

  try {
    const created = await client.addAlbum({
      albumTitle: input.albumTitle,
      artistName: input.artistName,
      foreignAlbumId: input.foreignAlbumId,
      foreignArtistId: input.foreignArtistId
    });

    return { exists: false, lidarrAlbumId: created.id, payload: created };
  } catch (error) {
    // If Lidarr needs artist context first, create the artist without monitoring all albums.
    if (input.foreignArtistId && config.lidarrRootFolder && config.lidarrQualityProfileId) {
      const existingArtist = await client.getExistingArtistByForeignId(input.foreignArtistId);

      if (!existingArtist) {
        await client.addArtist({
          artistName: input.artistName,
          foreignArtistId: input.foreignArtistId,
          qualityProfileId: config.lidarrQualityProfileId,
          metadataProfileId: config.lidarrMetadataProfileId ?? undefined,
          rootFolderPath: config.lidarrRootFolder,
          monitorMode: "none"
        });
      }

      const created = await client.addAlbum({
        albumTitle: input.albumTitle,
        artistName: input.artistName,
        foreignAlbumId: input.foreignAlbumId,
        foreignArtistId: input.foreignArtistId
      });

      return { exists: false, lidarrAlbumId: created.id, payload: created };
    }

    throw error;
  }
};

const createPendingArtistRequest = async (input: CreateArtistRequestInput) => {
  return prisma.request.create({
    data: {
      requestType: RequestType.ARTIST,
      requestedById: input.requestedById,
      artistName: input.artistName,
      foreignArtistId: input.foreignArtistId,
      mbid: input.mbid,
      status: RequestStatus.PENDING
    }
  });
};

const createPendingAlbumRequest = async (input: CreateAlbumRequestInput) => {
  return prisma.request.create({
    data: {
      requestType: RequestType.ALBUM,
      requestedById: input.requestedById,
      artistName: input.artistName,
      albumTitle: input.albumTitle,
      foreignArtistId: input.foreignArtistId,
      foreignAlbumId: input.foreignAlbumId,
      status: RequestStatus.PENDING
    }
  });
};

export const createArtistRequest = async (input: CreateArtistRequestInput) => {
  const duplicate = await hasDuplicateArtistRequest(input.foreignArtistId);
  if (duplicate) {
    return {
      request: duplicate,
      duplicate: true
    };
  }

  const config = await getRuntimeConfig();

  if (!config.requestAutoApprove) {
    const pending = await createPendingArtistRequest(input);
    return { request: pending, duplicate: false };
  }

  const created = await prisma.request.create({
    data: {
      requestType: RequestType.ARTIST,
      requestedById: input.requestedById,
      artistName: input.artistName,
      foreignArtistId: input.foreignArtistId,
      mbid: input.mbid,
      status: RequestStatus.APPROVED
    }
  });

  try {
    const result = await submitArtistToLidarr(input);
    const updated = await prisma.request.update({
      where: { id: created.id },
      data: {
        status: result.exists ? RequestStatus.ALREADY_EXISTS : RequestStatus.SUBMITTED,
        lidarrArtistId: result.lidarrArtistId,
        lidarrResponse: result.payload as any,
        failureReason: null
      }
    });

    return { request: updated, duplicate: false };
  } catch (error) {
    const updated = await prisma.request.update({
      where: { id: created.id },
      data: {
        status: RequestStatus.FAILED,
        failureReason: error instanceof Error ? error.message : "Unknown Lidarr error"
      }
    });

    return { request: updated, duplicate: false };
  }
};

export const createAlbumRequest = async (input: CreateAlbumRequestInput) => {
  const duplicate = await hasDuplicateAlbumRequest({
    foreignAlbumId: input.foreignAlbumId,
    artistName: input.artistName,
    albumTitle: input.albumTitle
  });

  if (duplicate) {
    return {
      request: duplicate,
      duplicate: true
    };
  }

  const config = await getRuntimeConfig();

  if (!config.requestAutoApprove) {
    const pending = await createPendingAlbumRequest(input);
    return { request: pending, duplicate: false };
  }

  const created = await prisma.request.create({
    data: {
      requestType: RequestType.ALBUM,
      requestedById: input.requestedById,
      artistName: input.artistName,
      albumTitle: input.albumTitle,
      foreignArtistId: input.foreignArtistId,
      foreignAlbumId: input.foreignAlbumId,
      status: RequestStatus.APPROVED
    }
  });

  try {
    const result = await submitAlbumToLidarr(input);
    const updated = await prisma.request.update({
      where: { id: created.id },
      data: {
        status: result.exists ? RequestStatus.ALREADY_EXISTS : RequestStatus.SUBMITTED,
        lidarrAlbumId: result.lidarrAlbumId,
        lidarrResponse: result.payload as any,
        failureReason: null
      }
    });

    return { request: updated, duplicate: false };
  } catch (error) {
    const updated = await prisma.request.update({
      where: { id: created.id },
      data: {
        status: RequestStatus.FAILED,
        failureReason: error instanceof Error ? error.message : "Unknown Lidarr error"
      }
    });

    return { request: updated, duplicate: false };
  }
};

export const approvePendingRequest = async (requestId: string) => {
  const request = await prisma.request.findUnique({ where: { id: requestId } });
  if (!request) {
    throw new Error("Request not found");
  }

  if (request.status !== RequestStatus.PENDING) {
    return request;
  }

  await prisma.request.update({
    where: { id: requestId },
    data: { status: RequestStatus.APPROVED }
  });

  try {
    if (request.requestType === RequestType.ALBUM) {
      if (!request.albumTitle) {
        throw new Error("Album title is missing for this request");
      }

      const result = await submitAlbumToLidarr({
        artistName: request.artistName,
        albumTitle: request.albumTitle,
        foreignArtistId: request.foreignArtistId ?? undefined,
        foreignAlbumId: request.foreignAlbumId ?? undefined
      });

      return prisma.request.update({
        where: { id: requestId },
        data: {
          status: result.exists ? RequestStatus.ALREADY_EXISTS : RequestStatus.SUBMITTED,
          lidarrAlbumId: result.lidarrAlbumId,
          lidarrResponse: result.payload as any,
          failureReason: null
        }
      });
    }

    const result = await submitArtistToLidarr({
      artistName: request.artistName,
      foreignArtistId: request.foreignArtistId ?? undefined,
      mbid: request.mbid ?? undefined
    });

    return prisma.request.update({
      where: { id: requestId },
      data: {
        status: result.exists ? RequestStatus.ALREADY_EXISTS : RequestStatus.SUBMITTED,
        lidarrArtistId: result.lidarrArtistId,
        lidarrResponse: result.payload as any,
        failureReason: null
      }
    });
  } catch (error) {
    return prisma.request.update({
      where: { id: requestId },
      data: {
        status: RequestStatus.FAILED,
        failureReason: error instanceof Error ? error.message : "Unknown Lidarr error"
      }
    });
  }
};
