import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { formatDurationSeconds } from '../dateUtils.js';

function candidateLabel(c) {
  const parts = [c.scheduledDate, c.title];
  if (c.actualDurationSeconds) parts.push(formatDurationSeconds(c.actualDurationSeconds));
  if (c.details?.distance) parts.push(c.details.distance);
  return parts.join(' · ');
}

export function MatchStravaControl({ workoutId, onMatched, onCancel }) {
  const [candidates, setCandidates] = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState(null);
  const [matching, setMatching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .listLinkCandidates(workoutId)
      .then((data) => {
        if (cancelled) return;
        setCandidates(data.candidates);
        setSelectedId(data.candidates[0]?.id || '');
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [workoutId]);

  async function handleMatch() {
    if (!selectedId) return;
    setMatching(true);
    setError(null);
    try {
      const data = await api.linkStravaActivity(workoutId, selectedId);
      onMatched(data.workout);
    } catch (err) {
      setError(err.message);
      setMatching(false);
    }
  }

  return (
    <div className="match-strava-control">
      {error && <p className="form-error">{error}</p>}

      {candidates === null && !error && <p className="page-loading">Loading matches…</p>}

      {candidates && candidates.length === 0 && (
        <p className="empty-hint">No unmatched Strava activities nearby.</p>
      )}

      {candidates && candidates.length > 0 && (
        <div className="match-strava-row">
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} disabled={matching}>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {candidateLabel(c)}
              </option>
            ))}
          </select>
          <button type="button" className="primary" onClick={handleMatch} disabled={matching}>
            {matching ? 'Matching…' : 'Match'}
          </button>
          <button type="button" onClick={onCancel} disabled={matching}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
