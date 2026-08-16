import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { CalendarPage } from './CalendarPage.jsx';

const LAST_ATHLETE_KEY = 'coachLastSelectedAthlete';

export function CoachHomePage() {
  const [athletes, setAthletes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .listCoachRelationships()
      .then((data) => {
        setAthletes(data.athletes);
        const remembered = localStorage.getItem(LAST_ATHLETE_KEY);
        const stillValid = data.athletes.some((a) => a.userId === remembered);
        setSelectedId(stillValid ? remembered : data.athletes[0]?.userId ?? null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function handleSelect(id) {
    setSelectedId(id);
    localStorage.setItem(LAST_ATHLETE_KEY, id);
  }

  if (loading) return <p className="page-loading">Loading…</p>;
  if (error) return <p className="form-error">{error}</p>;

  if (athletes.length === 0) {
    return (
      <div className="coach-page">
        <h1>Coach dashboard</h1>
        <p className="empty-hint">
          No athletes yet. <Link to="/coach/athletes">Find an athlete</Link> to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="coach-page">
      <div className="coach-athlete-select-row">
        <select
          className="coach-athlete-select"
          value={selectedId || ''}
          onChange={(e) => handleSelect(e.target.value)}
        >
          {athletes.map((a) => (
            <option key={a.userId} value={a.userId}>
              {a.displayName}
            </option>
          ))}
        </select>
      </div>
      {selectedId && <CalendarPage athleteId={selectedId} key={selectedId} />}
    </div>
  );
}
