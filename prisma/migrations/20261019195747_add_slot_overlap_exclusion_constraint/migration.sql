-- Enable btree_gist extension for combining scalar and range types in exclusion constraints
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Enforce PostgreSQL database-level exclusion constraint preventing overlapping time intervals for the same doctor
ALTER TABLE "availability_slots"
ADD CONSTRAINT "no_overlapping_active_slots"
EXCLUDE USING gist (
  "doctorId" WITH =,
  tstzrange("startTime", "endTime") WITH &&
) WHERE ("status" != 'CANCELLED');