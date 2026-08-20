import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { formatDurationSeconds } from '../dateUtils.js';

export function isMatchedPlan(workout) {
  if (!workout?.stravaActivityId) return false;
  if (workout.details?.fromPlan) return true;
  return Boolean(
    workout.plannedDurationSeconds ||
      workout.notes ||
      workout.details?.plannedDistance ||
      (workout.createdBy && workout.userId && workout.createdBy !== workout.userId)
  );
}

function candidateLabel(c) {
  const parts = [c.scheduledDate, c.title];
  const duration = c.actualDurationSeconds || c.plannedDurationSeconds;
  if (duration) parts.push(formatDurationSeconds(duration));
  if (c.details?.distance || c.details?.plannedDistance) {
    parts.push(c.details.distance || c.details.plannedDistance);
  }
  return parts.join(' · ');
}

export function MatchStravaControl({ workoutId, onMatched, onCancel }) {
  const [candidates, setCandidates] = useState(null);
  const [matchKind, setMatchKind] = useState('activity');
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState(null);
  const [matching, setMatching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .listLinkCandidates(workoutId)
      .then((data) => {
        if (cancelled) return;
        setMatchKind(data.matchKind || 'activity');
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

  const emptyHint =
    matchKind === 'plan'
      ? 'No unmatched planned workouts nearby.'
      : 'No unmatched Strava activities nearby.';

  return (
    <div className="match-strava-control">
      {error && <p className="form-error">{error}</p>}

      {candidates === null && !error && <p className="page-loading">Loading matches…</p>}

      {candidates && candidates.length === 0 && <p className="empty-hint">{emptyHint}</p>}

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
