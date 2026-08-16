-- Coach-athlete relationship: directional (coach requests, athlete accepts),
-- unlike friendships which are symmetric. Reuses friendship_status since the
-- pending/accepted shape is identical.
CREATE TABLE coach_athletes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status friendship_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT coach_athletes_not_self CHECK (coach_id <> athlete_id),
  CONSTRAINT coach_athletes_unique_pair UNIQUE (coach_id, athlete_id)
);

-- Who actually created the workout — the owner themselves (default), or a
-- coach acting on the athlete's behalf. Lets the UI show "made by you" vs
-- "made by coach X" without guessing from source/visibility.
ALTER TABLE workouts ADD COLUMN created_by UUID REFERENCES users(id);
UPDATE workouts SET created_by = user_id WHERE created_by IS NULL;
ALTER TABLE workouts ALTER COLUMN created_by SET NOT NULL;

-- A simple open comment thread per workout — an athlete or their accepted
-- coach can post at any time, before or after the session.
CREATE TABLE workout_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX workout_comments_workout_idx ON workout_comments (workout_id, created_at);
