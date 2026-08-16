import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';

export function AthleteFinderPage() {
  const navigate = useNavigate();
  const [athletes, setAthletes] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sendMessage, setSendMessage] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);

  const loadAll = useCallback(async () => {
    setError(null);
    try {
      const data = await api.listCoachRelationships();
      setAthletes(data.athletes);
      setOutgoing(data.outgoingRequests);
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
      const res = await api.sendAthleteRequest(email);
      setSendMessage(`Request sent to ${res.athlete.displayName}.`);
      setEmail('');
      await loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
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
      <h1>Athletes</h1>
      {error && <p className="form-error">{error}</p>}

      <section className="settings-card">
        <h2>Find an athlete</h2>
        <p className="settings-status">
          Send a request by email. Once they accept, you'll see their calendar and can plan workouts
          for them.
        </p>
        <form className="add-friend-form" onSubmit={handleSendRequest}>
          <input
            type="email"
            placeholder="athlete@example.com"
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

      {outgoing.length > 0 && (
        <section className="settings-card">
          <h2>Sent requests</h2>
          {outgoing.map((a) => (
            <div key={a.userId} className="friend-row">
              <span>{a.displayName}</span>
              <button type="button" className="link-button" onClick={() => handleRemove(a.userId)}>
                Cancel
              </button>
            </div>
          ))}
        </section>
      )}

      <section className="settings-card">
        <h2>Your athletes</h2>
        {athletes.length === 0 && <p className="empty-hint">No athletes yet — send a request above.</p>}
        {athletes.map((a) => (
          <div key={a.userId} className="friend-row">
            <button type="button" className="link-button" onClick={() => navigate('/')}>
              {a.displayName}
            </button>
            <button type="button" className="link-button" onClick={() => setRemoveTarget(a)}>
              Remove
            </button>
          </div>
        ))}
      </section>

      {removeTarget && (
        <ConfirmDialog
          title="Remove athlete?"
          message={`You'll lose access to ${removeTarget.displayName}'s workouts and calendar.`}
          confirmLabel="Remove"
          onConfirm={() => handleRemove(removeTarget.userId)}
          onCancel={() => setRemoveTarget(null)}
        />
      )}
    </div>
  );
}
