-- One rest marker per athlete per day.
CREATE UNIQUE INDEX workouts_one_rest_per_day
  ON workouts (user_id, scheduled_date)
  WHERE sport = 'rest';
