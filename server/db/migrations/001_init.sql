-- Full v1 schema, including tables not used until later phases (Section 3 of the project plan).
-- This is deliberate: sport/visibility/friendship shapes are baked in now so later phases don't
-- require a migration to add what's already here.

CREATE TYPE sport_type AS ENUM ('swim', 'bike', 'run', 'strength', 'other');
CREATE TYPE workout_visibility AS ENUM ('hidden', 'close_friends', 'everyone');
CREATE TYPE workout_source AS ENUM ('manual', 'strava_synced');
CREATE TYPE friendship_status AS ENUM ('pending', 'accepted');
CREATE TYPE overlap_status AS ENUM ('suggested', 'dismissed', 'accepted');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  strava_athlete_id TEXT UNIQUE,
  strava_access_token TEXT,
  strava_refresh_token TEXT,
  strava_token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Mutual opt-in close-friends list. A friendship is only "active" once both
-- directions (user_id -> friend_id and friend_id -> user_id) are 'accepted'.
-- Deliberately not a generic followers table.
CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status friendship_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT friendships_no_self CHECK (user_id <> friend_id),
  CONSTRAINT friendships_unique_pair UNIQUE (user_id, friend_id)
);

CREATE TABLE workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sport sport_type NOT NULL,
  title TEXT NOT NULL,
  notes TEXT,
  scheduled_date DATE NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  visibility workout_visibility NOT NULL DEFAULT 'hidden',
  source workout_source NOT NULL DEFAULT 'manual',
  strava_activity_id TEXT,
  planned_duration_seconds INTEGER,
  actual_duration_seconds INTEGER,
  -- sport-specific fields (pace, pool_length, power, distance, elevation, ...)
  -- kept as JSON so new sports/fields don't need a migration
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX workouts_user_date_idx ON workouts (user_id, scheduled_date);
CREATE UNIQUE INDEX workouts_strava_activity_unique ON workouts (strava_activity_id) WHERE strava_activity_id IS NOT NULL;

-- Computed training load (CTL/ATL/TSB), not user-entered. Recomputed by a
-- job in Phase 2 once Strava sync exists.
CREATE TABLE training_load (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  tss NUMERIC,
  ctl NUMERIC,
  atl NUMERIC,
  tsb NUMERIC,
  CONSTRAINT training_load_unique_day UNIQUE (user_id, date)
);

-- Phase 1.5 coordination feature; table exists now, logic lands later.
CREATE TABLE overlap_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id_a UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_id_b UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workout_id_a UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  workout_id_b UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  sport sport_type NOT NULL,
  status overlap_status NOT NULL DEFAULT 'suggested',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
