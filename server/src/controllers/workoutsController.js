import pool from '../db/pool.js';
import { getValidAccessToken, fetchStreams, fetchLaps } from '../services/stravaService.js';
import { isAcceptedCoach } from './coachController.js';
import { recomputeTrainingLoad } from '../services/trainingLoad.js';

const SPORTS = ['swim', 'bike', 'run', 'strength', 'other'];
const VISIBILITIES = ['hidden', 'close_friends', 'everyone'];

function toDateOnlyString(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
}

function toPublicWorkout(row) {
  return {
    id: row.id,
    sport: row.sport,
    title: row.title,
    notes: row.notes,
    scheduledDate: toDateOnlyString(row.scheduled_date),
    isCompleted: row.is_completed,
    visibility: row.visibility,
    source: row.source,
    stravaActivityId: row.strava_activity_id,
    plannedDurationSeconds: row.planned_duration_seconds,
    actualDurationSeconds: row.actual_duration_seconds,
    details: row.details,
    createdBy: row.created_by,
    userId: row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validateSportAndVisibility(sport, visibility) {
  if (sport !== undefined && !SPORTS.includes(sport)) {
    const err = new Error('invalid sport');
    err.status = 400;
    err.publicMessage = `sport must be one of: ${SPORTS.join(', ')}`;
    throw err;
  }
  if (visibility !== undefined && !VISIBILITIES.includes(visibility)) {
    const err = new Error('invalid visibility');
    err.status = 400;
    err.publicMessage = `visibility must be one of: ${VISIBILITIES.join(', ')}`;
    throw err;
  }
}

// Loads a workout by id and figures out what the requesting user may do with
// it: the owner can do anything; an accepted coach can always view, but can
// only edit/delete workouts they themselves created for that athlete.
export async function loadWorkoutAccess(userId, workoutId) {
  const result = await pool.query('SELECT * FROM workouts WHERE id = $1', [workoutId]);
  const workout = result.rows[0];
  if (!workout) return { workout: null, canView: false, canEdit: false };

  if (workout.user_id === userId) {
    return { workout, canView: true, canEdit: true };
  }

  const isCoach = await isAcceptedCoach(userId, workout.user_id);
  if (!isCoach) return { workout, canView: false, canEdit: false };

  return { workout, canView: true, canEdit: workout.created_by === userId };
}

// GET /api/workouts?start=YYYY-MM-DD&end=YYYY-MM-DD[&athleteId=]
export async function listWorkouts(req, res) {
  const { start, end } = req.query;
  const params = [req.targetUserId];
  let query = 'SELECT * FROM workouts WHERE user_id = $1';

  if (start) {
    params.push(start);
    query += ` AND scheduled_date >= $${params.length}`;
  }
  if (end) {
    params.push(end);
    query += ` AND scheduled_date <= $${params.length}`;
  }
  query += ' ORDER BY scheduled_date ASC, created_at ASC';

  const result = await pool.query(query, params);
  res.json({ workouts: result.rows.map(toPublicWorkout) });
}

export async function getWorkout(req, res) {
  const { workout, canView } = await loadWorkoutAccess(req.userId, req.params.id);
  if (!workout || !canView) {
    return res.status(404).json({ error: 'Workout not found' });
  }

  const publicWorkout = toPublicWorkout(workout);

  // Only meaningful when someone other than the athlete made it — i.e. a
  // coach created it on the athlete's behalf.
  if (workout.created_by !== workout.user_id) {
    const creator = await pool.query('SELECT display_name FROM users WHERE id = $1', [
      workout.created_by,
    ]);
    publicWorkout.createdByName = creator.rows[0]?.display_name ?? null;
  }

  res.json({ workout: publicWorkout });
}

// POST /api/workouts — body may include athleteId when a coach is creating
// a workout on behalf of one of their athletes.
export async function createWorkout(req, res) {
  const {
    sport,
    title,
    notes = null,
    scheduledDate,
    visibility = 'hidden',
    plannedDurationSeconds = null,
    details = {},
  } = req.body;

  if (!sport || !title || !scheduledDate) {
    return res.status(400).json({ error: 'sport, title, and scheduledDate are required' });
  }
  validateSportAndVisibility(sport, visibility);

  const result = await pool.query(
    `INSERT INTO workouts
       (user_id, created_by, sport, title, notes, scheduled_date, visibility, planned_duration_seconds, details)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      req.targetUserId,
      req.userId,
      sport,
      title,
      notes,
      scheduledDate,
      visibility,
      plannedDurationSeconds,
      details,
    ]
  );

  res.status(201).json({ workout: toPublicWorkout(result.rows[0]) });
}

export async function updateWorkout(req, res) {
  const { workout: current, canEdit } = await loadWorkoutAccess(req.userId, req.params.id);
  if (!current || !canEdit) {
    return res.status(404).json({ error: 'Workout not found' });
  }

  const {
    sport = current.sport,
    title = current.title,
    notes = current.notes,
    scheduledDate = current.scheduled_date,
    visibility = current.visibility,
    plannedDurationSeconds = current.planned_duration_seconds,
    actualDurationSeconds = current.actual_duration_seconds,
    isCompleted = current.is_completed,
    details = current.details,
  } = req.body;

  validateSportAndVisibility(sport, visibility);

  // Once a synced workout's title is hand-edited, protect it from being
  // clobbered by that activity's name on the next Strava sync.
  const titleCustom = current.title_custom || title !== current.title;

  const result = await pool.query(
    `UPDATE workouts SET
       sport = $1, title = $2, notes = $3, scheduled_date = $4, visibility = $5,
       planned_duration_seconds = $6, actual_duration_seconds = $7, is_completed = $8,
       details = $9, title_custom = $10, updated_at = now()
     WHERE id = $11
     RETURNING *`,
    [
      sport,
      title,
      notes,
      scheduledDate,
      visibility,
      plannedDurationSeconds,
      actualDurationSeconds,
      isCompleted,
      details,
      titleCustom,
      req.params.id,
    ]
  );

  res.json({ workout: toPublicWorkout(result.rows[0]) });
}

// PATCH /api/workouts/:id/complete — quick action to log actual vs planned
export async function completeWorkout(req, res) {
  const { actualDurationSeconds = null, details } = req.body;

  const { workout: current, canEdit } = await loadWorkoutAccess(req.userId, req.params.id);
  if (!current || !canEdit) {
    return res.status(404).json({ error: 'Workout not found' });
  }

  const mergedDetails = details ? { ...current.details, ...details } : current.details;

  const result = await pool.query(
    `UPDATE workouts SET
       is_completed = true, actual_duration_seconds = $1, details = $2, updated_at = now()
     WHERE id = $3
     RETURNING *`,
    [actualDurationSeconds, mergedDetails, req.params.id]
  );

  res.json({ workout: toPublicWorkout(result.rows[0]) });
}

// GET /api/workouts/:id/streams — on-demand, cached after first fetch.
export async function getWorkoutStreams(req, res) {
  const { workout, canView } = await loadWorkoutAccess(req.userId, req.params.id);
  if (!workout || !canView) {
    return res.status(404).json({ error: 'Workout not found' });
  }
  if (!workout.strava_activity_id) {
    return res.status(400).json({ error: 'This workout has no Strava activity data' });
  }

  let cached = await pool.query(
    'SELECT stream_type, data FROM workout_streams WHERE workout_id = $1',
    [workout.id]
  );

  if (cached.rows.length === 0) {
    // Streams are fetched using the athlete's own Strava connection, not the
    // coach's — the activity belongs to the athlete's Strava account.
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [workout.user_id]);
    const accessToken = await getValidAccessToken(userResult.rows[0]);
    const streams = await fetchStreams(accessToken, workout.strava_activity_id, 'medium');
    const entries = Object.entries(streams);

    for (const [type, stream] of entries) {
      await pool.query(
        `INSERT INTO workout_streams (workout_id, stream_type, data)
         VALUES ($1, $2, $3)
         ON CONFLICT (workout_id, stream_type) DO UPDATE SET data = EXCLUDED.data, fetched_at = now()`,
        [workout.id, type, JSON.stringify(stream.data)]
      );
    }

    cached = { rows: entries.map(([type, stream]) => ({ stream_type: type, data: stream.data })) };
  }

  const streamsByType = {};
  for (const row of cached.rows) {
    streamsByType[row.stream_type] = row.data;
  }

  res.json({ sport: workout.sport, streams: streamsByType });
}

function toPublicLap(lap, index) {
  return {
    index: index + 1,
    name: lap.name || `Lap ${index + 1}`,
    elapsedSeconds: lap.elapsed_time ?? null,
    movingSeconds: lap.moving_time ?? null,
    distanceMeters: lap.distance ?? null,
    avgSpeedMps: lap.average_speed ?? null,
    avgHr: lap.average_heartrate ?? null,
    avgWatts: lap.average_watts ?? null,
    avgCadence: lap.average_cadence ?? null,
    elevationGainMeters: lap.total_elevation_gain ?? null,
  };
}

// GET /api/workouts/:id/laps — on-demand, cached after first fetch.
export async function getWorkoutLaps(req, res) {
  const { workout, canView } = await loadWorkoutAccess(req.userId, req.params.id);
  if (!workout || !canView) {
    return res.status(404).json({ error: 'Workout not found' });
  }
  if (!workout.strava_activity_id) {
    return res.status(400).json({ error: 'This workout has no Strava activity data' });
  }

  let cached = await pool.query('SELECT data FROM workout_laps WHERE workout_id = $1', [workout.id]);

  if (cached.rows.length === 0) {
    // Laps belong to the athlete's Strava account, same as streams — fetch
    // with the athlete's token even when a coach is viewing.
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [workout.user_id]);
    const accessToken = await getValidAccessToken(userResult.rows[0]);
    const rawLaps = await fetchLaps(accessToken, workout.strava_activity_id);

    await pool.query(
      `INSERT INTO workout_laps (workout_id, data)
       VALUES ($1, $2)
       ON CONFLICT (workout_id) DO UPDATE SET data = EXCLUDED.data, fetched_at = now()`,
      [workout.id, JSON.stringify(rawLaps)]
    );

    cached = { rows: [{ data: rawLaps }] };
  }

  const laps = cached.rows[0].data.map(toPublicLap);
  res.json({ sport: workout.sport, laps });
}

const LINK_CANDIDATE_WINDOW_DAYS = 14;

// GET /api/workouts/:id/link-candidates — nearby synced activities a planned
// workout could be manually merged into, for when auto-matching at sync
// time missed it (dates too far apart, or more than one same-day/sport
// planned workout existed). Athlete-only, same as the merge itself.
export async function listLinkCandidates(req, res) {
  const result = await pool.query('SELECT * FROM workouts WHERE id = $1', [req.params.id]);
  const planned = result.rows[0];
  if (!planned || planned.user_id !== req.userId) {
    return res.status(404).json({ error: 'Workout not found' });
  }
  if (planned.source !== 'manual' || planned.is_completed || planned.strava_activity_id) {
    return res.status(400).json({ error: 'This workout is not an unmatched planned workout' });
  }

  const candidates = await pool.query(
    `SELECT * FROM workouts
     WHERE user_id = $1 AND source = 'strava_synced' AND strava_activity_id IS NOT NULL
       AND scheduled_date BETWEEN $2::date - ($3 || ' days')::interval AND $2::date + ($3 || ' days')::interval
     ORDER BY ABS(scheduled_date - $2::date) ASC, scheduled_date DESC
     LIMIT 20`,
    [req.userId, planned.scheduled_date, LINK_CANDIDATE_WINDOW_DAYS]
  );

  res.json({ candidates: candidates.rows.map(toPublicWorkout) });
}

// POST /api/workouts/:id/link-strava — manually merges a synced activity
// (found via listLinkCandidates) into this planned workout, the fallback for
// when the automatic same-day/sport matching at sync time didn't catch it.
// Keeps the planned workout's title/notes/planned duration, and deletes the
// now-redundant synced duplicate after moving its cached streams/laps/
// comments over.
export async function linkStravaActivity(req, res) {
  const { syncedWorkoutId } = req.body;
  if (!syncedWorkoutId) {
    return res.status(400).json({ error: 'syncedWorkoutId is required' });
  }

  const plannedResult = await pool.query('SELECT * FROM workouts WHERE id = $1', [req.params.id]);
  const planned = plannedResult.rows[0];
  if (!planned || planned.user_id !== req.userId) {
    return res.status(404).json({ error: 'Workout not found' });
  }
  if (planned.source !== 'manual' || planned.is_completed || planned.strava_activity_id) {
    return res.status(400).json({ error: 'This workout is not an unmatched planned workout' });
  }

  const syncedResult = await pool.query('SELECT * FROM workouts WHERE id = $1', [syncedWorkoutId]);
  const synced = syncedResult.rows[0];
  if (!synced || synced.user_id !== req.userId) {
    return res.status(404).json({ error: 'Strava activity not found' });
  }
  if (synced.source !== 'strava_synced' || !synced.strava_activity_id) {
    return res.status(400).json({ error: 'That workout is not a synced Strava activity' });
  }

  const client = await pool.connect();
  let merged;
  try {
    await client.query('BEGIN');

    // Move cached children off the duplicate row and delete it before
    // stamping its strava_activity_id onto the planned row — both rows
    // would otherwise briefly hold the same id and trip the unique
    // constraint on workouts.strava_activity_id.
    await client.query('UPDATE workout_streams SET workout_id = $1 WHERE workout_id = $2', [
      planned.id,
      synced.id,
    ]);
    await client.query('UPDATE workout_laps SET workout_id = $1 WHERE workout_id = $2', [
      planned.id,
      synced.id,
    ]);
    await client.query('UPDATE workout_comments SET workout_id = $1 WHERE workout_id = $2', [
      planned.id,
      synced.id,
    ]);
    await client.query('DELETE FROM workouts WHERE id = $1', [synced.id]);

    const updateResult = await client.query(
      `UPDATE workouts SET
         scheduled_date = $1, is_completed = true, source = 'strava_synced',
         strava_activity_id = $2, actual_duration_seconds = $3, details = $4, updated_at = now()
       WHERE id = $5
       RETURNING *`,
      [synced.scheduled_date, synced.strava_activity_id, synced.actual_duration_seconds, synced.details, planned.id]
    );
    merged = updateResult.rows[0];

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  await recomputeTrainingLoad(req.userId);

  res.json({ workout: toPublicWorkout(merged) });
}

export async function deleteWorkout(req, res) {
  const { workout, canEdit } = await loadWorkoutAccess(req.userId, req.params.id);
  if (!workout || !canEdit) {
    return res.status(404).json({ error: 'Workout not found' });
  }
  await pool.query('DELETE FROM workouts WHERE id = $1', [req.params.id]);
  res.status(204).end();
}
