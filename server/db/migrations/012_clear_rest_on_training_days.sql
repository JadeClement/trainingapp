-- Rest is exclusive with training: drop leftover rest markers on days that
-- already have a swim/bike/run/etc.
DELETE FROM workouts rest
WHERE rest.sport = 'rest'
  AND EXISTS (
    SELECT 1
    FROM workouts training
    WHERE training.user_id = rest.user_id
      AND training.scheduled_date = rest.scheduled_date
      AND training.sport <> 'rest'
  );
