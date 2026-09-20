import pool from '../db/pool.js';
import { DEFAULT_FEATURED_SPORTS } from './activityTypes.js';

export function toPublicUser(row) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    createdAt: row.created_at,
    activeMode: row.active_mode,
    weekStartsOn: row.week_starts_on ?? 'monday',
    featuredSports: row.featured_sports?.length ? row.featured_sports : [...DEFAULT_FEATURED_SPORTS],
    pinnedActivityTypes: row.pinned_activity_types ?? [],
    sportColors: row.sport_colors && typeof row.sport_colors === 'object' ? row.sport_colors : {},
    hasCoachProfile: row.has_coach_profile ?? false,
  };
}

export async function loadPublicUser(userId) {
  const result = await pool.query(
    `SELECT u.id, u.email, u.display_name, u.created_at, u.active_mode, u.week_starts_on,
            u.featured_sports, u.pinned_activity_types, u.sport_colors,
            EXISTS(SELECT 1 FROM coach_profiles cp WHERE cp.user_id = u.id) AS has_coach_profile
     FROM users u WHERE u.id = $1`,
    [userId]
  );
  return result.rows[0] ? toPublicUser(result.rows[0]) : null;
}
