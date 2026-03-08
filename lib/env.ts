const toInt = (value: string | undefined): number | undefined => {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const toBool = (value: string | undefined): boolean | undefined => {
  if (!value) return undefined;
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  return undefined;
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  appUrl: process.env.APP_URL,
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  sessionSecret: process.env.SESSION_SECRET,
  jellyfinUrl: process.env.JELLYFIN_URL,
  jellyfinApiKey: process.env.JELLYFIN_API_KEY,
  lidarrUrl: process.env.LIDARR_URL,
  lidarrApiKey: process.env.LIDARR_API_KEY,
  lidarrRootFolder: process.env.LIDARR_ROOT_FOLDER,
  lidarrQualityProfileId: toInt(process.env.LIDARR_QUALITY_PROFILE_ID),
  lidarrMetadataProfileId: toInt(process.env.LIDARR_METADATA_PROFILE_ID),
  lidarrMonitorMode: process.env.LIDARR_MONITOR_MODE,
  requestAutoApprove: toBool(process.env.REQUEST_AUTO_APPROVE)
};

export const isProduction = env.nodeEnv === "production";
