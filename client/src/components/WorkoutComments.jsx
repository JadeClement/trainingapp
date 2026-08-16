import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

function formatCommentTime(iso) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function WorkoutComments({ workoutId, workoutOwnerId }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    api
      .listComments(workoutId)
      .then((data) => setComments(data.comments))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [workoutId]);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    setPosting(true);
    setError(null);
    try {
      const data = await api.addComment(workoutId, trimmed);
      setComments((prev) => [...prev, data.comment]);
      setBody('');
    } catch (err) {
      setError(err.message);
    } finally {
      setPosting(false);
    }
  }

  async function handleDelete(commentId) {
    setError(null);
    try {
      await api.deleteComment(workoutId, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return null;

  return (
    <section className="comments-section">
      <h2 className="trend-section-title">Comments</h2>
      {error && <p className="form-error">{error}</p>}

      <div className="comment-list">
        {comments.length === 0 && <p className="empty-hint">No comments yet.</p>}
        {comments.map((c) => {
          const isMine = c.authorId === user.id;
          const isAthlete = c.authorId === workoutOwnerId;
          const roleLabel = isAthlete ? 'Athlete' : 'Coach';

          return (
            <div key={c.id} className={`comment ${isAthlete ? 'comment-athlete' : 'comment-coach'}`}>
              <div className="comment-meta">
                <span className="comment-role">{roleLabel}</span>
                <span className="comment-author">{isMine ? 'You' : c.authorName}</span>
                <span className="comment-time">{formatCommentTime(c.createdAt)}</span>
                {isMine && (
                  <button type="button" className="link-button" onClick={() => handleDelete(c.id)}>
                    Delete
                  </button>
                )}
              </div>
              <p className="comment-body">{c.body}</p>
            </div>
          );
        })}
      </div>

      <form className="comment-form" onSubmit={handleSubmit}>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a comment…"
          rows={2}
        />
        <button type="submit" className="primary" disabled={posting || !body.trim()}>
          {posting ? 'Posting…' : 'Post'}
        </button>
      </form>
    </section>
  );
}
