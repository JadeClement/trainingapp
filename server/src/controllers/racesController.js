import pool from '../db/pool.js';

const PRIORITIES = [1, 2, 3];

function toDateOnlyString(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'string') return value.slice(0, 10);
  return value;
}

function mapRace(row) {
  return {
    id: row.id,
    name: row.name,
    raceDate: toDateOnlyString(row.race_date),
    distance: row.distance,
    priority: row.priority,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parsePriority(value) {
  const n = Number(value);
  if (!PRIORITIES.includes(n)) return null;
  return n;
}

function parseRaceDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}

// GET /api/races
export async function listRaces(req, res) {
  const result = await pool.query(
    `SELECT id, name, race_date, distance, priority, notes, created_at, updated_at
     FROM races
     WHERE user_id = $1
     ORDER BY race_date ASC, priority ASC, name ASC`,
    [req.targetUserId]
  );
  res.json({ races: result.rows.map(mapRace) });
}

// POST /api/races
export async function createRace(req, res) {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const raceDate = parseRaceDate(req.body.raceDate);
  const distance =
    typeof req.body.distance === 'string' && req.body.distance.trim()
      ? req.body.distance.trim()
      : null;
  const notes =
    typeof req.body.notes === 'string' && req.body.notes.trim() ? req.body.notes.trim() : null;
  const priority = parsePriority(req.body.priority ?? 2);

  if (!name) return res.status(400).json({ error: 'name is required' });
  if (!raceDate) return res.status(400).json({ error: 'raceDate must be YYYY-MM-DD' });
  if (priority == null) return res.status(400).json({ error: 'priority must be 1, 2, or 3' });

  const result = await pool.query(
    `INSERT INTO races (user_id, name, race_date, distance, priority, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, race_date, distance, priority, notes, created_at, updated_at`,
    [req.targetUserId, name, raceDate, distance, priority, notes]
  );

  res.status(201).json({ race: mapRace(result.rows[0]) });
}

// PUT /api/races/:id
export async function updateRace(req, res) {
  const existing = await pool.query(
    'SELECT id FROM races WHERE id = $1 AND user_id = $2',
    [req.params.id, req.targetUserId]
  );
  if (existing.rows.length === 0) return res.status(404).json({ error: 'Race not found' });

  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const raceDate = parseRaceDate(req.body.raceDate);
  const distance =
    typeof req.body.distance === 'string' && req.body.distance.trim()
      ? req.body.distance.trim()
      : null;
  const notes =
    typeof req.body.notes === 'string' && req.body.notes.trim() ? req.body.notes.trim() : null;
  const priority = parsePriority(req.body.priority ?? 2);

  if (!name) return res.status(400).json({ error: 'name is required' });
  if (!raceDate) return res.status(400).json({ error: 'raceDate must be YYYY-MM-DD' });
  if (priority == null) return res.status(400).json({ error: 'priority must be 1, 2, or 3' });

  const result = await pool.query(
    `UPDATE races
     SET name = $1, race_date = $2, distance = $3, priority = $4, notes = $5, updated_at = now()
     WHERE id = $6 AND user_id = $7
     RETURNING id, name, race_date, distance, priority, notes, created_at, updated_at`,
    [name, raceDate, distance, priority, notes, req.params.id, req.targetUserId]
  );

  res.json({ race: mapRace(result.rows[0]) });
}

// DELETE /api/races/:id
export async function deleteRace(req, res) {
  const result = await pool.query(
    'DELETE FROM races WHERE id = $1 AND user_id = $2 RETURNING id',
    [req.params.id, req.targetUserId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Race not found' });
  res.status(204).end();
}
