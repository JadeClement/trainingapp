import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { sportMeta, formatDurationSeconds } from '../dateUtils.js';

export function LinkStravaDialog({ workoutId, onLinked, onClose }) {
  const [candidates, setCandidates] = useState(null);
  const [error, setError] = useState(null);
  const [linkingId, setLinkingId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .listLinkCandidates(workoutId)
      .then((data) => {
        if (!cancelled) setCandidates(data.candidates);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [workoutId]);

  async function handlePick(candidate) {
    setLinkingId(candidate.id);
    setError(null);
    try {
      const data = await api.linkStravaActivity(workoutId, candidate.id);
      onLinked(data.workout);
    } catch (err) {
      setError(err.message);
      setLinkingId(null);
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog activity-picker" onClick={(e) => e.stopPropagation()}>
        <div className="activity-picker-header">
          <h2>Link a Strava activity</h2>
          <button type="button" className="link-button" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="empty-hint" style={{ marginBottom: 12 }}>
          Pick the activity that's actually this planned workout — it'll be marked complete and
          keep this title and notes.
        </p>

        {error && <p className="form-error">{error}</p>}

        {candidates === null && !error && <p className="page-loading">Loading…</p>}

        {candidates && candidates.length === 0 && (
          <p className="empty-hint">No unmatched synced activities nearby.</p>
        )}

        <div className="activity-picker-list link-candidate-list">
          {candidates?.map((c) => (
            <button
              type="button"
              key={c.id}
              className="link-candidate-item"
              disabled={linkingId !== null}
              onClick={() => handlePick(c)}
            >
              <span className="link-candidate-main">
                <span className="link-candidate-title">{c.title}</span>
                <span className="link-candidate-meta">
                  {c.scheduledDate} · {sportMeta(c.sport).label}
                  {c.actualDurationSeconds ? ` · ${formatDurationSeconds(c.actualDurationSeconds)}` : ''}
                  {c.details?.distance ? ` · ${c.details.distance}` : ''}
                </span>
              </span>
              <span className="link-candidate-action">
                {linkingId === c.id ? 'Linking…' : 'Link'}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
