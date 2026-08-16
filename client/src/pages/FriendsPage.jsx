import { useEffect, useState, useCallback } from 'react';
import { api } from '../api.js';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import { sportMeta, formatDurationSeconds } from '../dateUtils.js';

export function FriendsPage() {
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [overlaps, setOverlaps] = useState([]);
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sendMessage, setSendMessage] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);

  const loadAll = useCallback(async () => {
    setError(null);
    try {
      const [friendsData, overlapsData, feedData] = await Promise.all([
        api.listFriends(),
        api.listOverlaps(),
        api.listFeed(),
      ]);
      setFriends(friendsData.friends);
      setIncoming(friendsData.incomingRequests);
      setOutgoing(friendsData.outgoingRequests);
      setOverlaps(overlapsData.overlaps);
      setFeed(feedData.workouts);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function handleSendRequest(e) {
    e.preventDefault();
    setSending(true);
    setSendMessage(null);
    setError(null);
    try {
      const res = await api.sendFriendRequest(email);
      setSendMessage(
        res.status === 'accepted'
          ? `You and ${res.friend.displayName} are now friends.`
          : `Request sent to ${res.friend.displayName}.`
      );
      setEmail('');
      await loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  async function handleAccept(userId) {
    setError(null);
    try {
      await api.acceptFriendRequest(userId);
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRemove(userId) {
    setRemoveTarget(null);
    setError(null);
    try {
      await api.removeFriend(userId);
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleOverlapAction(id, action) {
    setError(null);
    try {
      await api.updateOverlap(id, action);
      setOverlaps((prev) => prev.filter((o) => o.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p className="page-loading">Loading…</p>;

  return (
    <div className="friends-page">
      <h1>Friends</h1>
      {error && <p className="form-error">{error}</p>}

      {overlaps.length > 0 && (
        <section className="settings-card overlaps-card">
          <h2>Training together?</h2>
          {overlaps.map((o) => (
            <div key={o.id} className="overlap-row">
              <span>
                You and <strong>{o.friendName}</strong> both have {sportMeta(o.sport).label.toLowerCase()}{' '}
                planned on {o.date}.
              </span>
              <div className="overlap-actions">
                <button type="button" onClick={() => handleOverlapAction(o.id, 'accept')}>
                  Sounds good
                </button>
                <button type="button" className="link-button" onClick={() => handleOverlapAction(o.id, 'dismiss')}>
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="settings-card">
        <h2>Add a friend</h2>
        <form className="add-friend-form" onSubmit={handleSendRequest}>
          <input
            type="email"
            placeholder="friend@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button type="submit" className="primary" disabled={sending}>
            {sending ? 'Sending…' : 'Send request'}
          </button>
        </form>
        {sendMessage && <p className="settings-status">{sendMessage}</p>}
      </section>

      {incoming.length > 0 && (
        <section className="settings-card">
          <h2>Requests</h2>
          {incoming.map((f) => (
            <div key={f.userId} className="friend-row">
              <span>{f.displayName}</span>
              <div className="friend-row-actions">
                <button type="button" onClick={() => handleAccept(f.userId)}>
                  Accept
                </button>
                <button type="button" className="link-button" onClick={() => handleRemove(f.userId)}>
                  Decline
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {outgoing.length > 0 && (
        <section className="settings-card">
          <h2>Sent requests</h2>
          {outgoing.map((f) => (
            <div key={f.userId} className="friend-row">
              <span>{f.displayName}</span>
              <button type="button" className="link-button" onClick={() => handleRemove(f.userId)}>
                Cancel
              </button>
            </div>
          ))}
        </section>
      )}

      <section className="settings-card">
        <h2>Your friends</h2>
        {friends.length === 0 && <p className="empty-hint">No friends yet — add one above.</p>}
        {friends.map((f) => (
          <div key={f.userId} className="friend-row">
            <span>{f.displayName}</span>
            <button type="button" className="link-button" onClick={() => setRemoveTarget(f)}>
              Remove
            </button>
          </div>
        ))}
      </section>

      <section className="settings-card">
        <h2>Feed</h2>
        {feed.length === 0 && <p className="empty-hint">No visible workouts from friends yet.</p>}
        {feed.map((w) => {
          const meta = sportMeta(w.sport);
          const label = w.details?.activityType || meta.label;
          const duration = formatDurationSeconds(w.actualDurationSeconds ?? w.plannedDurationSeconds);
          return (
            <div key={w.id} className="feed-row">
              <span className="sport-dot" style={{ backgroundColor: meta.color }} />
              <div className="feed-row-main">
                <span className="feed-row-title">
                  {w.friendName} · {w.title}
                </span>
                <span className="workout-row-meta">
                  {w.scheduledDate} · {label}
                  {duration ? ` · ${duration}` : ''}
                  {w.isCompleted ? ' · done' : ''}
                </span>
              </div>
            </div>
          );
        })}
      </section>

      {removeTarget && (
        <ConfirmDialog
          title="Remove friend?"
          message={`You and ${removeTarget.displayName} will no longer see each other's shared workouts.`}
          confirmLabel="Remove"
          onConfirm={() => handleRemove(removeTarget.userId)}
          onCancel={() => setRemoveTarget(null)}
        />
      )}
    </div>
  );
}
