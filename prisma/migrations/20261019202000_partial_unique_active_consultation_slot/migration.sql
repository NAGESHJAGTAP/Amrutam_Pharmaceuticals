-- Drop standard unconditional unique index on slotId to allow slot re-booking after cancellation
DROP INDEX IF EXISTS "consultations_slotId_key";

-- Create standard index on slotId for foreign key traversal performance
CREATE INDEX IF NOT EXISTS "consultations_slotId_idx" ON "consultations"("slotId");

-- Create partial unique index guaranteeing at most ONE active (non-cancelled) consultation per slot
CREATE UNIQUE INDEX IF NOT EXISTS "unique_active_consultation_slot" ON "consultations" ("slotId") WHERE ("status" != 'CANCELLED');
