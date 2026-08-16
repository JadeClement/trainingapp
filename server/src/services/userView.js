import pool from '../db/pool.js';

export function toPublicUser(row) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    createdAt: row.created_at,
    activeMode: row.active_mode,
    hasCoachProfile: row.has_coach_profile ?? false,
  };
}

export async function loadPublicUser(userId) {
  const result = await pool.query(
    `SELECT u.id, u.email, u.display_name, u.created_at, u.active_mode,
            EXISTS(SELECT 1 FROM coach_profiles cp WHERE cp.user_id = u.id) AS has_coach_profile
     FROM users u WHERE u.id = $1`,
    [userId]
  );
  return result.rows[0] ? toPublicUser(result.rows[0]) : null;
}
