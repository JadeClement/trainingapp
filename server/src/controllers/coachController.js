import pool from '../db/pool.js';
import { loadPublicUser } from '../services/userView.js';

// Whether `coachId` currently has accepted access to `athleteId`'s data.
export async function isAcceptedCoach(coachId, athleteId) {
  const result = await pool.query(
    `SELECT 1 FROM coach_athletes WHERE coach_id = $1 AND athlete_id = $2 AND status = 'accepted'`,
    [coachId, athleteId]
  );
  return result.rows.length > 0;
}

// POST /api/coach/profile — create a coach profile for the current user (idempotent)
export async function createCoachProfile(req, res) {
  await pool.query(
    'INSERT INTO coach_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING',
    [req.userId]
  );
  res.status(201).json({ user: await loadPublicUser(req.userId) });
}

// POST /api/coach/mode — { mode: 'personal' | 'coach' }, switches which account view is active
export async function setActiveMode(req, res) {
  const { mode } = req.body;
  if (mode !== 'personal' && mode !== 'coach') {
    return res.status(400).json({ error: "mode must be 'personal' or 'coach'" });
  }

  if (mode === 'coach') {
    const existing = await pool.query('SELECT 1 FROM coach_profiles WHERE user_id = $1', [req.userId]);
    if (existing.rows.length === 0) {
      return res.status(403).json({ error: 'Create a coach profile before switching to coach mode' });
    }
  }

  await pool.query('UPDATE users SET active_mode = $1 WHERE id = $2', [mode, req.userId]);
  res.json({ user: await loadPublicUser(req.userId) });
}

// POST /api/coach/athletes — { email }, coach sends a request to an athlete.
// Requests are one-directional (coach -> athlete); unlike friendships there's
// no mutual-simultaneous-request case since athletes never initiate here.
export async function sendAthleteRequest(req, res) {
  const hasCoachProfile = await pool.query('SELECT 1 FROM coach_profiles WHERE user_id = $1', [
    req.userId,
  ]);
  if (hasCoachProfile.rows.length === 0) {
    return res.status(403).json({ error: 'Create a coach profile first' });
  }

  const email = String(req.body.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'email is required' });

  const targetResult = await pool.query('SELECT id, display_name FROM users WHERE email = $1', [
    email,
  ]);
  const target = targetResult.rows[0];
  if (!target) return res.status(404).json({ error: 'No athlete found with that email' });
  if (target.id === req.userId) {
    return res.status(400).json({ error: "You can't coach yourself" });
  }

  const existing = await pool.query(
    'SELECT status FROM coach_athletes WHERE coach_id = $1 AND athlete_id = $2',
    [req.userId, target.id]
  );
  if (existing.rows[0]?.status === 'accepted') {
    return res.status(409).json({ error: 'You already coach this athlete' });
  }
  if (existing.rows[0]?.status === 'pending') {
    return res.status(409).json({ error: 'Request already sent' });
  }

  await pool.query(
    `INSERT INTO coach_athletes (coach_id, athlete_id, status) VALUES ($1, $2, 'pending')`,
    [req.userId, target.id]
  );

  res.status(201).json({ athlete: { userId: target.id, displayName: target.display_name } });
}

// GET /api/coach/relationships — everything for the current user, both as a
// coach and as an athlete, so one call serves the finder page, the coaches
// page, and the athlete-picker dropdown.
export async function listRelationships(req, res) {
  const [athletes, outgoingRequests, coaches, incomingRequests] = await Promise.all([
    pool.query(
      `SELECT u.id AS "userId", u.display_name AS "displayName"
       FROM coach_athletes ca JOIN users u ON u.id = ca.athlete_id
       WHERE ca.coach_id = $1 AND ca.status = 'accepted'
       ORDER BY u.display_name`,
      [req.userId]
    ),
    pool.query(
      `SELECT u.id AS "userId", u.display_name AS "displayName"
       FROM coach_athletes ca JOIN users u ON u.id = ca.athlete_id
       WHERE ca.coach_id = $1 AND ca.status = 'pending'
       ORDER BY u.display_name`,
      [req.userId]
    ),
    pool.query(
      `SELECT u.id AS "userId", u.display_name AS "displayName"
       FROM coach_athletes ca JOIN users u ON u.id = ca.coach_id
       WHERE ca.athlete_id = $1 AND ca.status = 'accepted'
       ORDER BY u.display_name`,
      [req.userId]
    ),
    pool.query(
      `SELECT u.id AS "userId", u.display_name AS "displayName"
       FROM coach_athletes ca JOIN users u ON u.id = ca.coach_id
       WHERE ca.athlete_id = $1 AND ca.status = 'pending'
       ORDER BY u.display_name`,
      [req.userId]
    ),
  ]);

  res.json({
    athletes: athletes.rows,
    outgoingRequests: outgoingRequests.rows,
    coaches: coaches.rows,
    incomingRequests: incomingRequests.rows,
  });
}

// POST /api/coach/relationships/:coachId/accept — athlete accepts a request
export async function acceptAthleteRequest(req, res) {
  const coachId = req.params.coachId;
  const result = await pool.query(
    `UPDATE coach_athletes SET status = 'accepted'
     WHERE coach_id = $1 AND athlete_id = $2 AND status = 'pending'
     RETURNING id`,
    [coachId, req.userId]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'No pending request from that coach' });
  }
  res.status(204).end();
}

// DELETE /api/coach/relationships/:otherUserId — unfriend-style removal,
// works whichever side calls it (coach dropping an athlete, or athlete
// dropping/declining a coach).
export async function removeRelationship(req, res) {
  const otherId = req.params.otherUserId;
  await pool.query(
    `DELETE FROM coach_athletes
     WHERE (coach_id = $1 AND athlete_id = $2) OR (athlete_id = $1 AND coach_id = $2)`,
    [req.userId, otherId]
  );
  res.status(204).end();
}
