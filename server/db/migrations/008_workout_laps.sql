-- On-demand cache for Strava's per-activity lap/interval data, fetched only
-- when a user opens a workout's detail view (same pattern as workout_streams).
CREATE TABLE workout_laps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE UNIQUE,
  data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
