import pool from '../db/pool.js';

// Invariant maintained by acceptRequest/sendRequest: an active (mutual)
// friendship always exists as TWO rows, (A,B,'accepted') and (B,A,'accepted').
// So checking a single direction's status is enough to know the friendship
// is active — we never leave it half-accepted.

// POST /api/friends/request — { email }
export async function sendRequest(req, res) {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'email is required' });

  const targetResult = await pool.query(
    'SELECT id, display_name FROM users WHERE email = $1',
    [email]
  );
  const target = targetResult.rows[0];
  if (!target) return res.status(404).json({ error: 'No user found with that email' });
  if (target.id === req.userId) {
    return res.status(400).json({ error: "You can't friend yourself" });
  }

  const existingMine = await pool.query(
    'SELECT status FROM friendships WHERE user_id = $1 AND friend_id = $2',
    [req.userId, target.id]
  );
  if (existingMine.rows[0]?.status === 'accepted') {
    return res.status(409).json({ error: 'Already friends' });
  }
  if (existingMine.rows[0]?.status === 'pending') {
    return res.status(409).json({ error: 'Request already sent' });
  }

  const theirs = await pool.query(
    'SELECT status FROM friendships WHERE user_id = $1 AND friend_id = $2',
    [target.id, req.userId]
  );

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (theirs.rows[0]?.status === 'pending') {
      // They already requested us — this new request is mutual, accept both.
      await client.query(
        `UPDATE friendships SET status = 'accepted' WHERE user_id = $1 AND friend_id = $2`,
        [target.id, req.userId]
      );
      await client.query(
        `INSERT INTO friendships (user_id, friend_id, status) VALUES ($1, $2, 'accepted')
         ON CONFLICT (user_id, friend_id) DO UPDATE SET status = 'accepted'`,
        [req.userId, target.id]
      );
    } else {
      await client.query(
        `INSERT INTO friendships (user_id, friend_id, status) VALUES ($1, $2, 'pending')`,
        [req.userId, target.id]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  res.status(201).json({
    status: theirs.rows[0]?.status === 'pending' ? 'accepted' : 'pending',
    friend: { userId: target.id, displayName: target.display_name },
  });
}

// GET /api/friends
export async function listFriends(req, res) {
  const [friends, incoming, outgoing] = await Promise.all([
    pool.query(
      `SELECT u.id AS "userId", u.display_name AS "displayName"
       FROM friendships f JOIN users u ON u.id = f.friend_id
       WHERE f.user_id = $1 AND f.status = 'accepted'
       ORDER BY u.display_name`,
      [req.userId]
    ),
    pool.query(
      `SELECT u.id AS "userId", u.display_name AS "displayName"
       FROM friendships f JOIN users u ON u.id = f.user_id
       WHERE f.friend_id = $1 AND f.status = 'pending'
       ORDER BY u.display_name`,
      [req.userId]
    ),
    pool.query(
      `SELECT u.id AS "userId", u.display_name AS "displayName"
       FROM friendships f JOIN users u ON u.id = f.friend_id
       WHERE f.user_id = $1 AND f.status = 'pending'
       ORDER BY u.display_name`,
      [req.userId]
    ),
  ]);

  res.json({
    friends: friends.rows,
    incomingRequests: incoming.rows,
    outgoingRequests: outgoing.rows,
  });
}

// POST /api/friends/:userId/accept
export async function acceptRequest(req, res) {
  const otherId = req.params.userId;

  const pending = await pool.query(
    `SELECT 1 FROM friendships WHERE user_id = $1 AND friend_id = $2 AND status = 'pending'`,
    [otherId, req.userId]
  );
  if (pending.rows.length === 0) {
    return res.status(404).json({ error: 'No pending request from that user' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE friendships SET status = 'accepted' WHERE user_id = $1 AND friend_id = $2`,
      [otherId, req.userId]
    );
    await client.query(
      `INSERT INTO friendships (user_id, friend_id, status) VALUES ($1, $2, 'accepted')
       ON CONFLICT (user_id, friend_id) DO UPDATE SET status = 'accepted'`,
      [req.userId, otherId]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  res.status(204).end();
}

// DELETE /api/friends/:userId — unfriend, decline an incoming request, or
// cancel an outgoing one; all just mean "remove any edge between us".
export async function removeFriend(req, res) {
  const otherId = req.params.userId;
  await pool.query(
    `DELETE FROM friendships WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
    [req.userId, otherId]
  );
  res.status(204).end();
}

// GET /api/friends/feed?start=YYYY-MM-DD&end=YYYY-MM-DD
// Defaults to a week back through a month ahead when no range is given.
export async function listFeed(req, res) {
  const start = req.query.start || null;
  const end = req.query.end || null;

  const result = await pool.query(
    `SELECT w.id, w.user_id AS "userId", u.display_name AS "friendName", w.sport, w.title,
            w.scheduled_date::text AS "scheduledDate", w.is_completed AS "isCompleted",
            w.visibility, w.planned_duration_seconds AS "plannedDurationSeconds",
            w.actual_duration_seconds AS "actualDurationSeconds", w.details
     FROM workouts w
     JOIN users u ON u.id = w.user_id
     JOIN friendships f ON f.user_id = $1 AND f.friend_id = w.user_id AND f.status = 'accepted'
     WHERE w.visibility IN ('close_friends', 'everyone')
       AND w.scheduled_date >= COALESCE($2::date, CURRENT_DATE - INTERVAL '7 days')
       AND w.scheduled_date <= COALESCE($3::date, CURRENT_DATE + INTERVAL '30 days')
     ORDER BY w.scheduled_date ASC`,
    [req.userId, start, end]
  );

  res.json({ workouts: result.rows });
}

// GET /api/friends/overlaps
// Simple same-date/same-sport match between the caller's upcoming workouts
// and a mutual friend's, where both are visible to each other. Newly found
// pairs are persisted as 'suggested'; already-flagged pairs aren't re-added
// (see the unique index on workout_id_a/workout_id_b).
export async function listOverlaps(req, res) {
  await pool.query(
    `INSERT INTO overlap_flags (user_id_a, user_id_b, workout_id_a, workout_id_b, date, sport, status)
     SELECT
       CASE WHEN w1.id < w2.id THEN w1.user_id ELSE w2.user_id END,
       CASE WHEN w1.id < w2.id THEN w2.user_id ELSE w1.user_id END,
       LEAST(w1.id, w2.id),
       GREATEST(w1.id, w2.id),
       w1.scheduled_date,
       w1.sport,
       'suggested'
     FROM workouts w1
     JOIN workouts w2 ON w2.scheduled_date = w1.scheduled_date AND w2.sport = w1.sport AND w2.user_id <> w1.user_id
     JOIN friendships f ON f.user_id = w1.user_id AND f.friend_id = w2.user_id AND f.status = 'accepted'
     WHERE w1.user_id = $1
       AND w1.scheduled_date >= CURRENT_DATE
       AND w1.visibility IN ('close_friends', 'everyone')
       AND w2.visibility IN ('close_friends', 'everyone')
     ON CONFLICT (workout_id_a, workout_id_b) DO NOTHING`,
    [req.userId]
  );

  const result = await pool.query(
    `SELECT
       o.id, o.date::text AS date, o.sport, o.status,
       CASE WHEN o.user_id_a = $1 THEN o.user_id_b ELSE o.user_id_a END AS "friendId",
       u.display_name AS "friendName",
       CASE WHEN o.user_id_a = $1 THEN w_a.title ELSE w_b.title END AS "myWorkoutTitle",
       CASE WHEN o.user_id_a = $1 THEN w_b.title ELSE w_a.title END AS "friendWorkoutTitle"
     FROM overlap_flags o
     JOIN users u ON u.id = CASE WHEN o.user_id_a = $1 THEN o.user_id_b ELSE o.user_id_a END
     JOIN workouts w_a ON w_a.id = o.workout_id_a
     JOIN workouts w_b ON w_b.id = o.workout_id_b
     WHERE (o.user_id_a = $1 OR o.user_id_b = $1) AND o.status = 'suggested'
     ORDER BY o.date ASC`,
    [req.userId]
  );

  res.json({ overlaps: result.rows });
}

// POST /api/friends/overlaps/:id/:action — action is 'accept' or 'dismiss'
export async function updateOverlap(req, res) {
  const { id, action } = req.params;
  if (!['accept', 'dismiss'].includes(action)) {
    return res.status(400).json({ error: 'action must be accept or dismiss' });
  }
  const status = action === 'accept' ? 'accepted' : 'dismissed';

  const result = await pool.query(
    `UPDATE overlap_flags SET status = $1
     WHERE id = $2 AND (user_id_a = $3 OR user_id_b = $3)
     RETURNING id`,
    [status, id, req.userId]
  );

  if (result.rows.length === 0) return res.status(404).json({ error: 'Overlap not found' });
  res.status(204).end();
}
