import { useEffect, useState, useCallback } from 'react';
import { api } from '../api.js';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';

export function CoachesPage() {
  const [coaches, setCoaches] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);

  const loadAll = useCallback(async () => {
    setError(null);
    try {
      const data = await api.listCoachRelationships();
      setCoaches(data.coaches);
      setIncoming(data.incomingRequests);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function handleAccept(coachId) {
    setError(null);
    try {
      await api.acceptCoachRequest(coachId);
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRemove(userId) {
    setRemoveTarget(null);
    setError(null);
    try {
      await api.removeCoachRelationship(userId);
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p className="page-loading">Loading…</p>;

  return (
    <div className="friends-page">
      <h1>Coaches</h1>
      {error && <p className="form-error">{error}</p>}

      {incoming.length > 0 && (
        <section className="settings-card">
          <h2>Requests</h2>
          <p className="settings-status">
            Accepting gives this coach full visibility into your workouts (regardless of visibility
            settings) and lets them plan workouts and leave comments for you.
          </p>
          {incoming.map((c) => (
            <div key={c.userId} className="friend-row">
              <span>{c.displayName}</span>
              <div className="friend-row-actions">
                <button type="button" onClick={() => handleAccept(c.userId)}>
                  Accept
                </button>
                <button type="button" className="link-button" onClick={() => handleRemove(c.userId)}>
                  Decline
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="settings-card">
        <h2>Your coaches</h2>
        {coaches.length === 0 && (
          <p className="empty-hint">No coaches yet — a coach can send you a request by email.</p>
        )}
        {coaches.map((c) => (
          <div key={c.userId} className="friend-row">
            <span>{c.displayName}</span>
            <button type="button" className="link-button" onClick={() => setRemoveTarget(c)}>
              Remove
            </button>
          </div>
        ))}
      </section>

      {removeTarget && (
        <ConfirmDialog
          title="Remove coach?"
          message={`${removeTarget.displayName} will lose access to your workouts and calendar.`}
          confirmLabel="Remove"
          onConfirm={() => handleRemove(removeTarget.userId)}
          onCancel={() => setRemoveTarget(null)}
        />
      )}
    </div>
  );
}
