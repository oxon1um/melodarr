import { AppConfig } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { decryptText, encryptText } from "@/lib/crypto/secrets";
import { env } from "@/lib/env";
import { ensureAppConfig } from "@/lib/runtime/app-config";

export type RuntimeConfig = {
  appUrl: string;
  jellyfinUrl: string | null;
  jellyfinApiKey: string | null;
  lidarrUrl: string | null;
  lidarrApiKey: string | null;
  lidarrRootFolder: string | null;
  lidarrQualityProfileId: number | null;
  lidarrMetadataProfileId: number | null;
  lidarrMonitorMode: string;
  requestAutoApprove: boolean;
};

const fromAppConfig = async (config: AppConfig): Promise<RuntimeConfig> => {
  const [jellyfinApiKey, lidarrApiKey] = await Promise.all([
    config.jellyfinApiKeyEncrypted
      ? decryptText(config.jellyfinApiKeyEncrypted)
      : Promise.resolve(null),
    config.lidarrApiKeyEncrypted
      ? decryptText(config.lidarrApiKeyEncrypted)
      : Promise.resolve(null)
  ]);

  return {
    appUrl: config.appUrl?.trim() || env.appUrl?.trim() || "http://localhost:3000",
    jellyfinUrl: config.jellyfinUrl,
    jellyfinApiKey,
    lidarrUrl: config.lidarrUrl,
    lidarrApiKey,
    lidarrRootFolder: config.lidarrRootFolder,
    lidarrQualityProfileId: config.lidarrQualityProfileId,
    lidarrMetadataProfileId: config.lidarrMetadataProfileId,
    lidarrMonitorMode: config.lidarrMonitorMode ?? "all",
    requestAutoApprove: config.requestAutoApprove
  };
};

export const getRuntimeConfig = async (): Promise<RuntimeConfig> => {
  const persisted = await ensureAppConfig();
  const base = await fromAppConfig(persisted);

  return {
    appUrl: base.appUrl,
    jellyfinUrl: env.jellyfinUrl ?? base.jellyfinUrl,
    jellyfinApiKey: env.jellyfinApiKey ?? base.jellyfinApiKey,
    lidarrUrl: env.lidarrUrl ?? base.lidarrUrl,
    lidarrApiKey: env.lidarrApiKey ?? base.lidarrApiKey,
    lidarrRootFolder: env.lidarrRootFolder ?? base.lidarrRootFolder,
    lidarrQualityProfileId: env.lidarrQualityProfileId ?? base.lidarrQualityProfileId,
    lidarrMetadataProfileId: env.lidarrMetadataProfileId ?? base.lidarrMetadataProfileId,
    lidarrMonitorMode: env.lidarrMonitorMode ?? base.lidarrMonitorMode,
    requestAutoApprove: env.requestAutoApprove ?? base.requestAutoApprove
  };
};

export type UpdateConfigInput = {
  appUrl?: string | null;
  jellyfinUrl?: string | null;
  jellyfinApiKey?: string | null;
  lidarrUrl?: string | null;
  lidarrApiKey?: string | null;
  lidarrRootFolder?: string | null;
  lidarrQualityProfileId?: number | null;
  lidarrMetadataProfileId?: number | null;
  lidarrMonitorMode?: string | null;
  requestAutoApprove?: boolean;
};

export const updateConfig = async (input: UpdateConfigInput): Promise<RuntimeConfig> => {
  await ensureAppConfig();

  const updateData: Record<string, unknown> = {};

  if (Object.prototype.hasOwnProperty.call(input, "appUrl")) {
    updateData.appUrl = input.appUrl;
  }
  if (Object.prototype.hasOwnProperty.call(input, "jellyfinUrl")) {
    updateData.jellyfinUrl = input.jellyfinUrl;
  }
  if (Object.prototype.hasOwnProperty.call(input, "jellyfinApiKey")) {
    updateData.jellyfinApiKeyEncrypted = input.jellyfinApiKey
      ? await encryptText(input.jellyfinApiKey)
      : null;
  }
  if (Object.prototype.hasOwnProperty.call(input, "lidarrUrl")) {
    updateData.lidarrUrl = input.lidarrUrl;
  }
  if (Object.prototype.hasOwnProperty.call(input, "lidarrApiKey")) {
    updateData.lidarrApiKeyEncrypted = input.lidarrApiKey
      ? await encryptText(input.lidarrApiKey)
      : null;
  }
  if (Object.prototype.hasOwnProperty.call(input, "lidarrRootFolder")) {
    updateData.lidarrRootFolder = input.lidarrRootFolder;
  }
  if (Object.prototype.hasOwnProperty.call(input, "lidarrQualityProfileId")) {
    updateData.lidarrQualityProfileId = input.lidarrQualityProfileId;
  }
  if (Object.prototype.hasOwnProperty.call(input, "lidarrMetadataProfileId")) {
    updateData.lidarrMetadataProfileId = input.lidarrMetadataProfileId;
  }
  if (Object.prototype.hasOwnProperty.call(input, "lidarrMonitorMode")) {
    updateData.lidarrMonitorMode = input.lidarrMonitorMode;
  }
  if (Object.prototype.hasOwnProperty.call(input, "requestAutoApprove")) {
    updateData.requestAutoApprove = input.requestAutoApprove;
  }

  await prisma.appConfig.update({
    where: { id: 1 },
    data: updateData
  });

  return getRuntimeConfig();
};
