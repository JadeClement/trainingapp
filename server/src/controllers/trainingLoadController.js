import pool from '../db/pool.js';

// GET /api/training-load?start=YYYY-MM-DD&end=YYYY-MM-DD
export async function listTrainingLoad(req, res) {
  const { start, end } = req.query;
  const params = [req.targetUserId];
  let query = "SELECT date::text AS date, tss, ctl, atl, tsb FROM training_load WHERE user_id = $1";

  if (start) {
    params.push(start);
    query += ` AND date >= $${params.length}`;
  }
  if (end) {
    params.push(end);
    query += ` AND date <= $${params.length}`;
  }
  query += ' ORDER BY date ASC';

  const result = await pool.query(query, params);
  res.json({
    trainingLoad: result.rows.map((row) => ({
      date: row.date,
      tss: Number(row.tss),
      ctl: Number(row.ctl),
      atl: Number(row.atl),
      tsb: Number(row.tsb),
    })),
  });
}
