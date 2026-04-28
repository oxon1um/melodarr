-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUBMITTED', 'COMPLETED', 'FAILED', 'ALREADY_EXISTS');

-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('ARTIST', 'ALBUM');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "jellyfinUserId" TEXT,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Request" (
    "id" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "requestType" "RequestType" NOT NULL DEFAULT 'ARTIST',
    "artistName" TEXT NOT NULL,
    "albumTitle" TEXT,
    "foreignArtistId" TEXT,
    "foreignAlbumId" TEXT,
    "mbid" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "lidarrArtistId" INTEGER,
    "lidarrAlbumId" INTEGER,
    "lidarrResponse" JSONB,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "appUrl" TEXT,
    "runtimeSecret" TEXT,
    "jellyfinUrl" TEXT,
    "jellyfinApiKeyEncrypted" TEXT,
    "lidarrUrl" TEXT,
    "lidarrApiKeyEncrypted" TEXT,
    "lidarrRootFolder" TEXT,
    "lidarrQualityProfileId" INTEGER,
    "lidarrMetadataProfileId" INTEGER,
    "lidarrMonitorMode" TEXT DEFAULT 'all',
    "requestAutoApprove" BOOLEAN NOT NULL DEFAULT true,
    "debugMode" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_jellyfinUserId_key" ON "User"("jellyfinUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Request_requestedById_idx" ON "Request"("requestedById");

-- CreateIndex
CREATE INDEX "Request_status_idx" ON "Request"("status");

-- CreateIndex
CREATE INDEX "Request_foreignArtistId_idx" ON "Request"("foreignArtistId");

-- CreateIndex
CREATE INDEX "Request_foreignAlbumId_idx" ON "Request"("foreignAlbumId");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
