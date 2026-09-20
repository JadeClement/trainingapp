-- Display-only prefs for Stats: which sports stay as own series vs roll into
-- Other, plus optional pinned activity types that escape the Other bucket.
ALTER TABLE users
  ADD COLUMN featured_sports text[] NOT NULL DEFAULT ARRAY['swim', 'bike', 'run'],
  ADD COLUMN pinned_activity_types text[] NOT NULL DEFAULT '{}';
