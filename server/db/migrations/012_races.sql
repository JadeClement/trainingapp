-- Goal races / events athletes are training toward. Home page shows a
-- countdown to the next upcoming race (or the one marked priority).
CREATE TABLE races (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  race_date DATE NOT NULL,
  -- Free-text distance/type label ("70.3", "Olympic", "5K", …)
  distance TEXT,
  -- Lower number = higher priority; A-races are typically 1.
  priority SMALLINT NOT NULL DEFAULT 2
    CHECK (priority >= 1 AND priority <= 3),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX races_user_date_idx ON races (user_id, race_date);
