-- On-demand cache for Strava's per-activity time-series data (streams),
-- fetched only when a user opens a workout's detail view — never in bulk
-- during sync, since streams are a separate, more rate-limit-sensitive
-- endpoint than the activity summaries already synced into workouts.
CREATE TABLE workout_streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  stream_type TEXT NOT NULL,
  data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT workout_streams_unique UNIQUE (workout_id, stream_type)
);

-- Used to derive heart-rate zone bands on the workout detail chart.
ALTER TABLE users ADD COLUMN max_hr INTEGER;
