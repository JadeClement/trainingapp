import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import pool from '../db/pool.js';
import {
  getAuthorizeUrl,
  exchangeCodeForToken,
  getValidAccessToken,
  fetchActivities,
} from '../services/stravaService.js';
import { mapStravaSportType, detailsWithPreservedPlan } from '../services/stravaMapping.js';
import { estimateTss, recomputeTrainingLoad } from '../services/trainingLoad.js';

const STATE_COOKIE = 'strava_oauth_state';
const DEFAULT_SYNC_LOOKBACK_DAYS = 90;

// GET /api/strava/connect — reached via a full-page navigation (not fetch),
// protected by requireAuth like any other route, since the JWT cookie is
// sent on top-level same-site navigations just like on normal requests.
export async function connect(req, res) {
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 10 * 60 * 1000,
  });

  res.redirect(getAuthorizeUrl(state));
}

// GET /api/strava/callback — Strava redirects the browser back here. This is
// still a same-site top-level navigation from the user's perspective, so the
// JWT cookie is present, but we verify it manually (instead of requireAuth)
// so an expired/missing session redirects back to the app instead of
// showing a bare JSON 401.
export async function callback(req, res) {
  const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  const token = req.cookies?.token;
  if (!token) return res.redirect(`${clientOrigin}/settings?strava=error`);

  let userId;
  try {
    userId = jwt.verify(token, process.env.JWT_SECRET).userId;
  } catch {
    return res.redirect(`${clientOrigin}/settings?strava=error`);
  }

  const { code, state, error } = req.query;
  const expectedState = req.cookies?.[STATE_COOKIE];
  res.clearCookie(STATE_COOKIE);

  if (error || !code || !state || state !== expectedState) {
    return res.redirect(`${clientOrigin}/settings?strava=error`);
  }

  try {
    const tokens = await exchangeCodeForToken(code);
    await pool.query(
      `UPDATE users SET
         strava_athlete_id = $1, strava_access_token = $2, strava_refresh_token = $3,
         strava_token_expires_at = to_timestamp($4)
       WHERE id = $5`,
      [String(tokens.athlete.id), tokens.access_token, tokens.refresh_token, tokens.expires_at, userId]
    );
    res.redirect(`${clientOrigin}/settings?strava=connected`);
  } catch (err) {
    console.error(err);
    res.redirect(`${clientOrigin}/settings?strava=error`);
  }
}

// GET /api/strava/status
export async function status(req, res) {
  const result = await pool.query(
    'SELECT strava_athlete_id FROM users WHERE id = $1',
    [req.userId]
  );
  const user = result.rows[0];
  res.json({ connected: Boolean(user?.strava_athlete_id), athleteId: user?.strava_athlete_id || null });
}

// DELETE /api/strava/disconnect
export async function disconnect(req, res) {
  await pool.query(
    `UPDATE users SET
       strava_athlete_id = NULL, strava_access_token = NULL,
       strava_refresh_token = NULL, strava_token_expires_at = NULL
     WHERE id = $1`,
    [req.userId]
  );
  res.status(204).end();
}

function metersToDistanceLabel(sport, meters) {
  if (!meters) return null;
  if (sport === 'swim') return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

// POST /api/strava/sync
export async function sync(req, res) {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);
  const user = result.rows[0];

  if (!user.strava_refresh_token) {
    return res.status(400).json({ error: 'Strava is not connected' });
  }

  const accessToken = await getValidAccessToken(user);

  const latest = await pool.query(
    `SELECT MAX(scheduled_date) AS date FROM workouts WHERE user_id = $1 AND source = 'strava_synced'`,
    [req.userId]
  );
  const after =
    latest.rows[0].date ||
    new Date(Date.now() - DEFAULT_SYNC_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  const activities = await fetchActivities(accessToken, new Date(after));

  for (const activity of activities) {
    const { sport, activityType } = mapStravaSportType(activity.sport_type || activity.type);
    const tss = estimateTss(activity);
    const scheduledDate = (activity.start_date_local || activity.start_date).slice(0, 10);
    const distance = metersToDistanceLabel(sport, activity.distance);

    const details = { activityType, tss, ...(distance ? { distance } : {}) };

    // Matching against a planned workout only makes sense for an activity
    // this app hasn't seen before — if it's already synced (e.g. a re-sync
    // whose date window overlaps a previous run), leave it to the ON
    // CONFLICT branch below rather than trying to re-claim its
    // strava_activity_id onto some other row and tripping the unique
    // constraint.
    const alreadySynced = await pool.query(
      'SELECT 1 FROM workouts WHERE strava_activity_id = $1',
      [String(activity.id)]
    );

    if (alreadySynced.rows.length === 0) {
      // Look for a single unmatched planned workout close to this activity's
      // date, same sport — if there's exactly one, this activity is almost
      // certainly that planned session actually happening, so merge into it
      // (keeping the planned title/notes/planned duration) instead of
      // creating a duplicate row. Ambiguous (0 or 2+) candidates fall
      // through to the normal insert-as-new-synced-workout path below.
      const candidates = await pool.query(
        `SELECT id, details FROM workouts
         WHERE user_id = $1 AND source = 'manual' AND strava_activity_id IS NULL
           AND sport = $2 AND scheduled_date BETWEEN $3::date - INTERVAL '1 day' AND $3::date + INTERVAL '1 day'`,
        [req.userId, sport, scheduledDate]
      );

      if (candidates.rows.length === 1) {
        await pool.query(
          `UPDATE workouts SET
             scheduled_date = $1, is_completed = true, source = 'strava_synced',
             strava_activity_id = $2, actual_duration_seconds = $3, details = $4, updated_at = now()
           WHERE id = $5`,
          [
            scheduledDate,
            String(activity.id),
            activity.moving_time || null,
            detailsWithPreservedPlan(candidates.rows[0].details, details),
            candidates.rows[0].id,
          ]
        );
        continue;
      }
    }

    await pool.query(
      `INSERT INTO workouts
         (user_id, created_by, sport, title, scheduled_date, is_completed, visibility, source,
          strava_activity_id, actual_duration_seconds, details)
       VALUES ($1, $1, $2, $3, $4, true, 'hidden', 'strava_synced', $5, $6, $7)
       ON CONFLICT (strava_activity_id) WHERE strava_activity_id IS NOT NULL DO UPDATE SET
         sport = EXCLUDED.sport,
         title = CASE WHEN workouts.title_custom THEN workouts.title ELSE EXCLUDED.title END,
         scheduled_date = EXCLUDED.scheduled_date,
         actual_duration_seconds = EXCLUDED.actual_duration_seconds, details = EXCLUDED.details,
         updated_at = now()`,
      [
        req.userId,
        sport,
        activity.name || activityType,
        scheduledDate,
        String(activity.id),
        activity.moving_time || null,
        details,
      ]
    );
  }

  await recomputeTrainingLoad(req.userId);

  res.json({ synced: activities.length });
}
