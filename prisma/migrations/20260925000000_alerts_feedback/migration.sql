CREATE TYPE "FeedbackReason" AS ENUM ('NOT_RECRUITING', 'WRONG_CATEGORY', 'EXPIRED', 'DUPLICATE', 'BAD_LINK');

CREATE TABLE "EventFeedback" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "reason" "FeedbackReason" NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventFeedback_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EventFeedback_eventId_deviceId_key" ON "EventFeedback"("eventId", "deviceId");
CREATE INDEX "EventFeedback_reason_createdAt_idx" ON "EventFeedback"("reason", "createdAt");
ALTER TABLE "EventFeedback" ADD CONSTRAINT "EventFeedback_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AlertSubscription" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "categories" TEXT[],
  "companyNames" TEXT[],
  "eventTypes" TEXT[],
  "verificationToken" TEXT NOT NULL,
  "unsubscribeToken" TEXT NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "lastSentAt" TIMESTAMP(3),
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AlertSubscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AlertSubscription_email_key" ON "AlertSubscription"("email");
CREATE UNIQUE INDEX "AlertSubscription_verificationToken_key" ON "AlertSubscription"("verificationToken");
CREATE UNIQUE INDEX "AlertSubscription_unsubscribeToken_key" ON "AlertSubscription"("unsubscribeToken");
CREATE INDEX "AlertSubscription_enabled_verifiedAt_lastSentAt_idx" ON "AlertSubscription"("enabled", "verifiedAt", "lastSentAt");
