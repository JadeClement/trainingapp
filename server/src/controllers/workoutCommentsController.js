import pool from '../db/pool.js';
import { loadWorkoutAccess } from './workoutsController.js';

function toPublicComment(row) {
  return {
    id: row.id,
    workoutId: row.workout_id,
    authorId: row.author_id,
    authorName: row.author_name,
    body: row.body,
    createdAt: row.created_at,
  };
}

// GET /api/workouts/:id/comments
export async function listComments(req, res) {
  const { canView } = await loadWorkoutAccess(req.userId, req.params.id);
  if (!canView) return res.status(404).json({ error: 'Workout not found' });

  const result = await pool.query(
    `SELECT c.id, c.workout_id, c.author_id, u.display_name AS author_name, c.body, c.created_at
     FROM workout_comments c JOIN users u ON u.id = c.author_id
     WHERE c.workout_id = $1
     ORDER BY c.created_at ASC`,
    [req.params.id]
  );

  res.json({ comments: result.rows.map(toPublicComment) });
}

// POST /api/workouts/:id/comments — { body }
export async function addComment(req, res) {
  const { canView } = await loadWorkoutAccess(req.userId, req.params.id);
  if (!canView) return res.status(404).json({ error: 'Workout not found' });

  const body = String(req.body.body || '').trim();
  if (!body) return res.status(400).json({ error: 'body is required' });

  const result = await pool.query(
    `INSERT INTO workout_comments (workout_id, author_id, body)
     VALUES ($1, $2, $3)
     RETURNING id, workout_id, author_id,
       (SELECT display_name FROM users WHERE id = author_id) AS author_name,
       body, created_at`,
    [req.params.id, req.userId, body]
  );

  res.status(201).json({ comment: toPublicComment(result.rows[0]) });
}

// DELETE /api/workouts/:id/comments/:commentId — author only
export async function deleteComment(req, res) {
  const { canView } = await loadWorkoutAccess(req.userId, req.params.id);
  if (!canView) return res.status(404).json({ error: 'Workout not found' });

  const result = await pool.query(
    'DELETE FROM workout_comments WHERE id = $1 AND workout_id = $2 AND author_id = $3 RETURNING id',
    [req.params.commentId, req.params.id, req.userId]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Comment not found' });
  }
  res.status(204).end();
}
