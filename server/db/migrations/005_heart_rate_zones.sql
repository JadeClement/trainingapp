-- Replaces the single global max HR with one per sport, since a runner's
-- and a cyclist's max HR (and therefore zone bands) genuinely differ.
CREATE TABLE heart_rate_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sport sport_type NOT NULL,
  max_hr INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT heart_rate_zones_unique UNIQUE (user_id, sport)
);

ALTER TABLE users DROP COLUMN max_hr;
