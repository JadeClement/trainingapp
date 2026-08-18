-- Calendar and stats weeks default to Monday; users can switch to Sunday in settings.
CREATE TYPE week_start AS ENUM ('sunday', 'monday');

ALTER TABLE users ADD COLUMN week_starts_on week_start NOT NULL DEFAULT 'monday';
