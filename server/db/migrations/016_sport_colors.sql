-- Per-user sport color overrides for calendar, stats, and elsewhere.
-- Keys are sport enum values or pin:<activityType>; values are #rrggbb hex.
ALTER TABLE users
  ADD COLUMN sport_colors jsonb NOT NULL DEFAULT '{}'::jsonb;
