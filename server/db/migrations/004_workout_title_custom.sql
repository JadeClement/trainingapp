-- Tracks whether a synced workout's title has been manually edited, so a
-- future Strava sync doesn't silently overwrite the user's own title.
ALTER TABLE workouts ADD COLUMN title_custom BOOLEAN NOT NULL DEFAULT false;
