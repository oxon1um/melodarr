import { Prisma, RequestStatus, RequestType } from "@prisma/client";
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

const positiveNumber = (value?: number | null) =>
  typeof value === "number" && value > 0 ? value : undefined;

const nonEmptyText = (value?: string | null) =>
  typeof value === "string" && value.trim().length > 0 ? value : undefined;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const normalizeIdentity = (value?: string | null) =>
  (value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const matchesRequestedAlbum = (
  album: {
    title?: string;
    artistName?: string;
    foreignAlbumId?: string;
    foreignArtistId?: string;
  },
  input: {
    artistName: string;
    albumTitle: string;
    foreignArtistId?: string;
    foreignAlbumId?: string;
  }
) => {
  if (input.foreignAlbumId && album.foreignAlbumId === input.foreignAlbumId) {
    return true;
  }

  const sameTitle = normalizeIdentity(album.title) === normalizeIdentity(input.albumTitle);
  const sameArtist = normalizeIdentity(album.artistName) === normalizeIdentity(input.artistName);
  const sameForeignArtist = !input.foreignArtistId || album.foreignArtistId === input.foreignArtistId;

  return sameTitle && sameArtist && sameForeignArtist;
};

const pickResponseId = (payload: unknown, ...keys: string[]) => {
  const item = asRecord(payload);
  if (!item) return undefined;

  for (const key of keys) {
    const value = item[key];
    if (typeof value === "number" && value > 0) {
      return value;
    }
  }

  return undefined;
};

const pickNestedResponseId = (payload: unknown, nestedKey: string, ...keys: string[]) => {
  const item = asRecord(payload);
  if (!item) return undefined;

  return pickResponseId(item[nestedKey], ...keys);
};

const resolveRequestedAlbum = async (
  client: LidarrClient,
  input: {
    artistName: string;
    albumTitle: string;
    foreignArtistId?: string;
    foreignAlbumId?: string;
  },
  lidarrArtistId?: number
) => {
  if (lidarrArtistId && lidarrArtistId > 0) {
    const trackedArtistAlbums = await client.getAlbumsByArtistId(lidarrArtistId);
    const trackedMatch = trackedArtistAlbums.find((album) => matchesRequestedAlbum(album, input));

    if (trackedMatch?.id) {
      return await client.getAlbumById(trackedMatch.id) ?? trackedMatch;
    }
  }

  if (input.foreignAlbumId) {
    const byForeignId = await client.getExistingAlbumByForeignId(input.foreignAlbumId);
    if (byForeignId) {
      return byForeignId;
    }
  }

  if (!input.foreignArtistId) {
    return null;
  }

  const artistAlbums = await client.getAlbumsByArtistForeignId(input.foreignArtistId, input.artistName);
  const match = artistAlbums.find((album) => matchesRequestedAlbum(album, input));

  if (match?.id) {
    return await client.getAlbumById(match.id) ?? match;
  }

  if (match?.foreignAlbumId) {
    return await client.getExistingAlbumByForeignId(match.foreignAlbumId);
  }

  return null;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const resolveRequestedAlbumWithRetries = async (
  client: LidarrClient,
  input: {
    artistName: string;
    albumTitle: string;
    foreignArtistId?: string;
    foreignAlbumId?: string;
  },
  lidarrArtistId?: number
) => {
  const delays = [0, 150, 300, 600, 900];

  for (const delayMs of delays) {
    if (delayMs > 0) {
      await wait(delayMs);
    }

    const resolved = await resolveRequestedAlbum(client, input, lidarrArtistId);
    if (resolved?.id) {
      return resolved;
    }
  }

  return null;
};

const submitArtistToLidarr = async (input: {
  artistName: string;
  foreignArtistId?: string;
  mbid?: string;
}) => {
  const { client, config } = await getLidarrClientOrThrow();
  const defaults = await client.getEffectiveAddDefaults({
    rootFolderPath: config.lidarrRootFolder,
    qualityProfileId: config.lidarrQualityProfileId,
    metadataProfileId: config.lidarrMetadataProfileId
  });

  if (!defaults.rootFolderPath || !defaults.qualityProfileId) {
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
    qualityProfileId: defaults.qualityProfileId,
    metadataProfileId: defaults.metadataProfileId,
    rootFolderPath: defaults.rootFolderPath,
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
  let existingArtist = input.foreignArtistId
    ? await client.getExistingArtistByForeignId(input.foreignArtistId)
    : null;
  const defaults = await client.getEffectiveAddDefaults({
    rootFolderPath: nonEmptyText(existingArtist?.rootFolderPath) ?? config.lidarrRootFolder,
    qualityProfileId: positiveNumber(existingArtist?.qualityProfileId) ?? config.lidarrQualityProfileId,
    metadataProfileId: positiveNumber(existingArtist?.metadataProfileId) ?? config.lidarrMetadataProfileId
  });
  const qualityProfileId = defaults.qualityProfileId;
  const metadataProfileId = defaults.metadataProfileId;
  const rootFolderPath = defaults.rootFolderPath;

  if (input.foreignAlbumId) {
    const existingAlbum = await client.getExistingAlbumByForeignId(input.foreignAlbumId);
    if (existingAlbum) {
      const wasAlreadyMonitored = existingAlbum.monitored === true;
      await client.setAlbumsMonitored([existingAlbum.id], true);
      await client.triggerAlbumSearch([existingAlbum.id]);

      return {
        exists: wasAlreadyMonitored,
        lidarrArtistId: existingArtist?.id,
        lidarrAlbumId: existingAlbum.id,
        payload: existingAlbum
      };
    }
  }

  if (!existingArtist && (!qualityProfileId || !rootFolderPath)) {
    throw new Error("Lidarr root folder and quality profile are required");
  }

  if (!existingArtist) {
    existingArtist = await client.addArtist({
      artistName: input.artistName,
      foreignArtistId: input.foreignArtistId,
      qualityProfileId: qualityProfileId!,
      metadataProfileId,
      rootFolderPath: rootFolderPath!,
      monitorMode: "none",
      monitored: false,
      searchForMissingAlbums: false
    });
  }

  const resolvedAlbum = await resolveRequestedAlbumWithRetries(client, input, existingArtist?.id);

  if (!resolvedAlbum?.id) {
    throw new Error("Selected Lidarr release could not be resolved for monitoring");
  }

  await client.setAlbumsMonitored([resolvedAlbum.id], true);
  await client.triggerAlbumSearch([resolvedAlbum.id]);

  return {
    exists: false,
    lidarrArtistId: existingArtist?.id,
    lidarrAlbumId: resolvedAlbum.id,
    payload: resolvedAlbum
  };
};

export const deleteRequestFromLidarr = async (requestId: string) => {
  const request = await prisma.request.findUnique({ where: { id: requestId } });
  if (!request) {
    throw new Error("Request not found");
  }

  const { client } = await getLidarrClientOrThrow();
  const responsePayload = asRecord(request.lidarrResponse);
  const requestArtistPayload = asRecord(responsePayload?.artist);

  if (request.requestType === RequestType.ALBUM) {
    const album = (request.lidarrAlbumId
      ? await client.getAlbumById(request.lidarrAlbumId)
      : null)
      ?? (pickResponseId(responsePayload, "id") ? await client.getAlbumById(pickResponseId(responsePayload, "id")!) : null)
      ?? (request.foreignAlbumId ? await client.getExistingAlbumByForeignId(request.foreignAlbumId) : null);

    if (album?.id) {
      await client.deleteAlbum(album.id, true);
    }

    return prisma.request.update({
      where: { id: requestId },
      data: {
        lidarrArtistId: null,
        lidarrAlbumId: null,
        lidarrResponse: Prisma.JsonNull,
        failureReason: null
      }
    });
  }

  const artist = (request.lidarrArtistId
    ? await client.getArtistById(request.lidarrArtistId)
    : null)
    ?? (pickResponseId(responsePayload, "id") ? await client.getArtistById(pickResponseId(responsePayload, "id")!) : null)
    ?? (pickNestedResponseId(responsePayload, "artist", "id") ? await client.getArtistById(pickNestedResponseId(responsePayload, "artist", "id")!) : null)
    ?? (request.foreignArtistId ? await client.getExistingArtistByForeignId(request.foreignArtistId) : null)
    ?? (pickResponseId(requestArtistPayload, "id") ? await client.getArtistById(pickResponseId(requestArtistPayload, "id")!) : null)
    ?? (request.foreignArtistId ? await client.getArtistByForeignId(request.foreignArtistId, request.artistName) : null);

  if (artist?.id) {
    await client.deleteArtist(artist.id, true);
  }

  return prisma.request.update({
    where: { id: requestId },
      data: {
        lidarrArtistId: null,
        lidarrAlbumId: null,
        lidarrResponse: Prisma.JsonNull,
        failureReason: null
      }
  });
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
        lidarrArtistId: result.lidarrArtistId ?? null,
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
          lidarrArtistId: result.lidarrArtistId ?? null,
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
