-- Earliest date we've asked Strava for. Independent of the oldest stored
-- workout so an empty 90-day stretch still moves the wall backward.
ALTER TABLE users ADD COLUMN strava_history_after DATE;
