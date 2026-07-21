BEGIN;

CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

CREATE TABLE "User" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "emailVerified" BOOLEAN NOT NULL DEFAULT FALSE,
  "image" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "Organization" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "logo" TEXT,
  "metadata" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "Jwks" (
  "id" TEXT PRIMARY KEY,
  "publicKey" TEXT NOT NULL,
  "privateKey" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "expiresAt" TIMESTAMPTZ
);

CREATE TABLE "Verification" (
  "id" TEXT PRIMARY KEY,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");

CREATE TABLE "Session" (
  "id" TEXT PRIMARY KEY,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL,
  "activeOrganizationId" TEXT,
  "activeTeamId" TEXT,
  CONSTRAINT "Session_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_activeOrganizationId_idx" ON "Session"("activeOrganizationId");
CREATE INDEX "Session_activeTeamId_idx" ON "Session"("activeTeamId");

CREATE TABLE "Account" (
  "id" TEXT PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" TIMESTAMPTZ,
  "refreshTokenExpiresAt" TIMESTAMPTZ,
  "scope" TEXT,
  "password" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Account_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "Account_providerId_accountId_key"
    UNIQUE ("providerId", "accountId")
);

CREATE INDEX "Account_userId_idx" ON "Account"("userId");

CREATE TABLE "Member" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Member_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "Member_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE,
  CONSTRAINT "Member_userId_organizationId_key"
    UNIQUE ("userId", "organizationId")
);

CREATE INDEX "Member_organizationId_idx" ON "Member"("organizationId");

CREATE TABLE "Invitation" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL,
  "inviterId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "role" TEXT,
  "status" TEXT NOT NULL,
  "teamId" TEXT,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Invitation_inviterId_fkey"
    FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "Invitation_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE
);

CREATE INDEX "Invitation_organizationId_idx" ON "Invitation"("organizationId");
CREATE INDEX "Invitation_teamId_idx" ON "Invitation"("teamId");

CREATE TABLE "Team" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Team_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE
);

CREATE INDEX "Team_organizationId_idx" ON "Team"("organizationId");

CREATE TABLE "TeamMember" (
  "id" TEXT PRIMARY KEY,
  "teamId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "TeamMember_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE,
  CONSTRAINT "TeamMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "TeamMember_teamId_userId_key"
    UNIQUE ("teamId", "userId")
);

CREATE INDEX "TeamMember_userId_idx" ON "TeamMember"("userId");

CREATE TABLE "ExtractionJob" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "teamId" TEXT,
  "sourceText" TEXT NOT NULL,
  "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
  "parsedCount" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "completedAt" TIMESTAMPTZ,
  CONSTRAINT "ExtractionJob_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE,
  CONSTRAINT "ExtractionJob_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "ExtractionJob_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL
);

CREATE INDEX "ExtractionJob_organizationId_createdAt_idx"
  ON "ExtractionJob"("organizationId", "createdAt");
CREATE INDEX "ExtractionJob_userId_createdAt_idx"
  ON "ExtractionJob"("userId", "createdAt");

CREATE TABLE "Transaction" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "teamId" TEXT,
  "extractionJobId" TEXT,
  "date" TIMESTAMPTZ NOT NULL,
  "description" TEXT NOT NULL,
  "amount" NUMERIC(14,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "balanceAfter" NUMERIC(14,2),
  "rawText" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION,
  "category" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Transaction_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE,
  CONSTRAINT "Transaction_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "Transaction_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL,
  CONSTRAINT "Transaction_extractionJobId_fkey"
    FOREIGN KEY ("extractionJobId") REFERENCES "ExtractionJob"("id") ON DELETE SET NULL
);

CREATE INDEX "Transaction_organizationId_createdAt_idx"
  ON "Transaction"("organizationId", "createdAt");
CREATE INDEX "Transaction_organizationId_date_idx"
  ON "Transaction"("organizationId", "date");
CREATE INDEX "Transaction_userId_createdAt_idx"
  ON "Transaction"("userId", "createdAt");
CREATE INDEX "Transaction_teamId_createdAt_idx"
  ON "Transaction"("teamId", "createdAt");

ALTER TABLE "Transaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExtractionJob" ENABLE ROW LEVEL SECURITY;

CREATE POLICY transaction_tenant_isolation ON "Transaction"
USING ("organizationId" = current_setting('app.current_organization_id', true));

CREATE POLICY extraction_job_tenant_isolation ON "ExtractionJob"
USING ("organizationId" = current_setting('app.current_organization_id', true));

COMMIT;