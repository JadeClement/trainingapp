import pool from '../db/pool.js';

// v1 TSS approximation: Strava's Relative Effort (suffer_score) is a
// normalized, HR-based effort score that's a reasonable stand-in for TSS
// without needing per-user FTP/threshold-HR configuration. When it's not
// available (e.g. no HR data on the activity) we fall back to a flat
// moderate-intensity estimate of 55 TSS/hour.
export function estimateTss(activity) {
  if (typeof activity.suffer_score === 'number') {
    return Math.round(activity.suffer_score);
  }
  const hours = (activity.moving_time || 0) / 3600;
  return Math.round(hours * 55);
}

// Recomputes the full CTL/ATL/TSB series for a user from their earliest
// TSS-bearing workout through today, and upserts it into training_load.
// CTL uses a 42-day time constant, ATL a 7-day time constant (both as the
// standard simplified recursive EWMA), and TSB for a given day reflects
// freshness going into that day (yesterday's CTL minus yesterday's ATL).
export async function recomputeTrainingLoad(userId) {
  const { rows } = await pool.query(
    `SELECT scheduled_date::text AS date, SUM((details->>'tss')::numeric) AS tss
     FROM workouts
     WHERE user_id = $1 AND details ? 'tss'
     GROUP BY scheduled_date
     ORDER BY scheduled_date ASC`,
    [userId]
  );

  if (rows.length === 0) return;

  const tssByDate = new Map(rows.map((r) => [r.date, Number(r.tss)]));
  const firstDate = new Date(rows[0].date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let ctlPrev = 0;
  let atlPrev = 0;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (let d = new Date(firstDate); d <= today; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      const todayTss = tssByDate.get(dateStr) || 0;
      const tsb = ctlPrev - atlPrev;
      const ctl = ctlPrev + (todayTss - ctlPrev) / 42;
      const atl = atlPrev + (todayTss - atlPrev) / 7;

      await client.query(
        `INSERT INTO training_load (user_id, date, tss, ctl, atl, tsb)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id, date) DO UPDATE SET
           tss = EXCLUDED.tss, ctl = EXCLUDED.ctl, atl = EXCLUDED.atl, tsb = EXCLUDED.tsb`,
        [userId, dateStr, todayTss, ctl.toFixed(1), atl.toFixed(1), tsb.toFixed(1)]
      );

      ctlPrev = ctl;
      atlPrev = atl;
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
