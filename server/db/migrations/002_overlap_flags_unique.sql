-- Prevents the same workout pair from being flagged twice regardless of
-- which of the two users' overlap computation discovers it first.
CREATE UNIQUE INDEX overlap_flags_workout_pair_unique ON overlap_flags (workout_id_a, workout_id_b);
