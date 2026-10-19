-- CreateTable
CREATE TABLE IF NOT EXISTS "webhook_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "eventId" VARCHAR(128) NOT NULL,
    "provider" VARCHAR(64) NOT NULL,
    "eventType" VARCHAR(64) NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "webhook_events_eventId_key" ON "webhook_events"("eventId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "webhook_events_provider_eventType_idx" ON "webhook_events"("provider", "eventType");
