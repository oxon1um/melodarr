import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/http";
import { JellyfinClient } from "@/lib/jellyfin/client";
import { LidarrClient } from "@/lib/lidarr/client";
import { prisma } from "@/lib/db/prisma";
import { getRuntimeConfig, updateConfig } from "@/lib/settings/store";

const settingsSchema = z.object({
  appUrl: z.string().url().nullable().optional(),
  jellyfinUrl: z.string().url().nullable().optional(),
  jellyfinApiKey: z.string().min(1).nullable().optional(),
  lidarrUrl: z.string().url().nullable().optional(),
  lidarrApiKey: z.string().min(1).nullable().optional(),
  lidarrRootFolder: z.string().min(1).nullable().optional(),
  lidarrQualityProfileId: z.number().int().positive().nullable().optional(),
  lidarrMetadataProfileId: z.number().int().positive().nullable().optional(),
  lidarrMonitorMode: z.string().min(1).nullable().optional(),
  requestAutoApprove: z.boolean().optional(),
  debugMode: z.boolean().optional(),
  testJellyfin: z.boolean().optional(),
  testLidarr: z.boolean().optional()
});

export async function GET(req: NextRequest) {
  try {
    const actor = await requireAdmin(req);
    const [self, bootstrapAdmin] = await Promise.all([
      prisma.user.findUnique({
        where: { id: actor.id },
        select: { id: true, passwordHash: true }
      }),
      prisma.user.findFirst({
        where: { role: "ADMIN" },
        orderBy: { createdAt: "asc" },
        select: { id: true }
      })
    ]);

    const canManagePassword =
      Boolean(self?.passwordHash) && Boolean(bootstrapAdmin?.id === actor.id);

    const config = await getRuntimeConfig();

    return jsonOk({
      config: {
        ...config,
        jellyfinApiKey: config.jellyfinApiKey ? "********" : null,
        lidarrApiKey: config.lidarrApiKey ? "********" : null
      },
      canManagePassword
    });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return jsonError(error instanceof Error ? error.message : "Failed to load settings", status);
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requireAdmin(req);
    const payload = settingsSchema.parse(await req.json());

    const updateInput: Parameters<typeof updateConfig>[0] = {};

    if (Object.prototype.hasOwnProperty.call(payload, "appUrl")) {
      updateInput.appUrl = payload.appUrl;
    }
    if (Object.prototype.hasOwnProperty.call(payload, "jellyfinUrl")) {
      updateInput.jellyfinUrl = payload.jellyfinUrl;
    }
    if (
      Object.prototype.hasOwnProperty.call(payload, "jellyfinApiKey") &&
      payload.jellyfinApiKey !== "********"
    ) {
      updateInput.jellyfinApiKey = payload.jellyfinApiKey;
    }
    if (Object.prototype.hasOwnProperty.call(payload, "lidarrUrl")) {
      updateInput.lidarrUrl = payload.lidarrUrl;
    }
    if (Object.prototype.hasOwnProperty.call(payload, "lidarrRootFolder")) {
      updateInput.lidarrRootFolder = payload.lidarrRootFolder;
    }
    if (Object.prototype.hasOwnProperty.call(payload, "lidarrQualityProfileId")) {
      updateInput.lidarrQualityProfileId = payload.lidarrQualityProfileId;
    }
    if (Object.prototype.hasOwnProperty.call(payload, "lidarrMetadataProfileId")) {
      updateInput.lidarrMetadataProfileId = payload.lidarrMetadataProfileId;
    }
    if (Object.prototype.hasOwnProperty.call(payload, "lidarrMonitorMode")) {
      updateInput.lidarrMonitorMode = payload.lidarrMonitorMode;
    }
    if (Object.prototype.hasOwnProperty.call(payload, "requestAutoApprove")) {
      updateInput.requestAutoApprove = payload.requestAutoApprove;
    }
    if (Object.prototype.hasOwnProperty.call(payload, "debugMode")) {
      updateInput.debugMode = payload.debugMode;
    }

    if (
      Object.prototype.hasOwnProperty.call(payload, "lidarrApiKey") &&
      payload.lidarrApiKey !== "********"
    ) {
      updateInput.lidarrApiKey = payload.lidarrApiKey;
    }

    const isConnectionTest = Boolean(payload.testJellyfin || payload.testLidarr);
    const currentConfig = isConnectionTest ? await getRuntimeConfig() : null;
    const resolvedConfig = isConnectionTest
      ? {
          ...currentConfig,
          ...updateInput,
          jellyfinApiKey:
            updateInput.jellyfinApiKey === undefined
              ? currentConfig?.jellyfinApiKey ?? null
              : updateInput.jellyfinApiKey,
          lidarrApiKey:
            updateInput.lidarrApiKey === undefined
              ? currentConfig?.lidarrApiKey ?? null
              : updateInput.lidarrApiKey
        }
      : await updateConfig(updateInput);

    if (payload.testJellyfin) {
      if (!resolvedConfig.jellyfinUrl) {
        return jsonError("Set Jellyfin server URL before testing connection", 400);
      }
      if (!resolvedConfig.jellyfinApiKey) {
        return jsonError("Set Jellyfin API key before testing connection", 400);
      }

      const jellyfin = new JellyfinClient(resolvedConfig.jellyfinUrl, resolvedConfig.jellyfinApiKey);
      await jellyfin.healthCheck();
    }

    if (payload.testLidarr) {
      if (!resolvedConfig.lidarrUrl) {
        return jsonError("Set Lidarr server URL before testing connection", 400);
      }
      if (!resolvedConfig.lidarrApiKey) {
        return jsonError("Set Lidarr API key before testing connection", 400);
      }

      const lidarr = new LidarrClient(resolvedConfig.lidarrUrl, resolvedConfig.lidarrApiKey);
      await lidarr.healthCheck();
    }

    return jsonOk({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(error.issues[0]?.message ?? "Invalid settings payload", 400);
    }

    const status = (error as { status?: number }).status ?? 500;
    return jsonError(error instanceof Error ? error.message : "Failed to update settings", status);
  }
}
