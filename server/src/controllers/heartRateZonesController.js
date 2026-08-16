import pool from '../db/pool.js';

const SPORTS = ['swim', 'bike', 'run', 'strength', 'other'];

// GET /api/heart-rate-zones
export async function listZones(req, res) {
  const result = await pool.query(
    'SELECT sport, max_hr AS "maxHr" FROM heart_rate_zones WHERE user_id = $1 ORDER BY sport',
    [req.userId]
  );
  res.json({ zones: result.rows });
}

// POST /api/heart-rate-zones — { sport, maxHr }, upserts one sport's max HR
export async function upsertZone(req, res) {
  const { sport, maxHr } = req.body;

  if (!SPORTS.includes(sport)) {
    return res.status(400).json({ error: `sport must be one of: ${SPORTS.join(', ')}` });
  }
  if (typeof maxHr !== 'number' || !Number.isFinite(maxHr) || maxHr < 100 || maxHr > 230) {
    return res.status(400).json({ error: 'maxHr must be a number between 100 and 230' });
  }

  const result = await pool.query(
    `INSERT INTO heart_rate_zones (user_id, sport, max_hr)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, sport) DO UPDATE SET max_hr = EXCLUDED.max_hr
     RETURNING sport, max_hr AS "maxHr"`,
    [req.userId, sport, maxHr]
  );

  res.status(201).json({ zone: result.rows[0] });
}

// DELETE /api/heart-rate-zones/:sport
export async function deleteZone(req, res) {
  const result = await pool.query(
    'DELETE FROM heart_rate_zones WHERE user_id = $1 AND sport = $2 RETURNING sport',
    [req.userId, req.params.sport]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'No zone set for that sport' });
  res.status(204).end();
}
