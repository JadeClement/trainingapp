import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import { summarizePeriod } from '../components/WeekStats.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
  addDays,
  formatDurationSeconds,
  sportMeta,
  startOfWeek,
  toISODate,
} from '../dateUtils.js';

const PRIORITY_LABELS = { 1: 'A', 2: 'B', 3: 'C' };

function daysUntil(isoDate) {
  const today = toISODate(new Date());
  const start = new Date(`${today}T12:00:00`);
  const end = new Date(`${isoDate}T12:00:00`);
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
}

function formatRaceDate(isoDate) {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function emptyRaceForm() {
  return { name: '', raceDate: '', distance: '', priority: 1, notes: '' };
}

function pickFeaturedRace(races) {
  const upcoming = races.filter((r) => daysUntil(r.raceDate) >= 0);
  if (upcoming.length === 0) return null;
  return [...upcoming].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.raceDate.localeCompare(b.raceDate);
  })[0];
}

export function HomePage({ athleteId }) {
  const { user } = useAuth();
  const weekStartsOn = user?.weekStartsOn || 'monday';

  const [races, setRaces] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(emptyRaceForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const weekStart = useMemo(
    () => startOfWeek(new Date(), weekStartsOn),
    [weekStartsOn]
  );
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const weekLabel = useMemo(() => {
    const opts = { month: 'short', day: 'numeric' };
    const startLabel = weekStart.toLocaleDateString(undefined, opts);
    const endLabel = weekEnd.toLocaleDateString(undefined, {
      ...opts,
      year: 'numeric',
    });
    return `${startLabel} – ${endLabel}`;
  }, [weekStart, weekEnd]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.listRaces(athleteId),
      api.listWorkouts(toISODate(weekStart), toISODate(weekEnd), athleteId),
    ])
      .then(([racesData, workoutsData]) => {
        setRaces(racesData.races);
        setWorkouts(workoutsData.workouts);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [athleteId, weekStart, weekEnd]);

  const weekRows = useMemo(() => summarizePeriod(workouts), [workouts]);
  const weekTotals = useMemo(
    () =>
      weekRows.reduce(
        (acc, row) => ({
          doneDuration: acc.doneDuration + row.doneDuration,
          plannedDuration: acc.plannedDuration + row.plannedDuration,
          doneCount: acc.doneCount + row.doneCount,
          plannedCount: acc.plannedCount + row.plannedCount,
        }),
        { doneDuration: 0, plannedDuration: 0, doneCount: 0, plannedCount: 0 }
      ),
    [weekRows]
  );

  const featured = useMemo(() => pickFeaturedRace(races), [races]);
  const featuredDays = featured ? daysUntil(featured.raceDate) : null;

  function openCreate() {
    setEditingId(null);
    setForm(emptyRaceForm());
    setShowForm(true);
  }

  function openEdit(race) {
    setEditingId(race.id);
    setForm({
      name: race.name,
      raceDate: race.raceDate,
      distance: race.distance || '',
      priority: race.priority,
      notes: race.notes || '',
    });
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyRaceForm());
  }

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const body = {
      name: form.name,
      raceDate: form.raceDate,
      distance: form.distance,
      priority: Number(form.priority),
      notes: form.notes,
    };
    try {
      if (editingId) {
        const data = await api.updateRace(editingId, body, athleteId);
        setRaces((prev) => prev.map((r) => (r.id === editingId ? data.race : r)));
      } else {
        const data = await api.createRace(body, athleteId);
        setRaces((prev) =>
          [...prev, data.race].sort((a, b) => a.raceDate.localeCompare(b.raceDate))
        );
      }
      cancelForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const id = deletingId;
    setDeletingId(null);
    if (!id) return;
    setError(null);
    try {
      await api.deleteRace(id, athleteId);
      setRaces((prev) => prev.filter((r) => r.id !== id));
      if (editingId === id) cancelForm();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p className="page-loading">Loading…</p>;

  return (
    <div className="home-page">
      <header className="home-hero">
        <p className="home-kicker">This week</p>
        <h1>{weekLabel}</h1>
        {weekRows.length === 0 ? (
          <p className="empty-hint">
            No workouts planned yet.{' '}
            <Link to="/plan">Open Plan</Link> to build the week.
          </p>
        ) : (
          <div className="home-week-metrics" aria-label="This week totals">
            {weekRows.map((row) => (
              <div key={row.sport} className="home-metric">
                <span className="home-metric-label">
                  <i
                    className="stats-sport-dot"
                    style={{ backgroundColor: sportMeta(row.sport).color }}
                  />
                  {sportMeta(row.sport).label}
                </span>
                <span className="home-metric-value">
                  {row.doneCount}/{row.plannedCount}
                </span>
              </div>
            ))}
            <div className="home-metric home-metric-hours">
              <span className="home-metric-label">Hours</span>
              <span className="home-metric-value">
                {formatDurationSeconds(weekTotals.doneDuration || 0)}
                {weekTotals.plannedDuration > 0
                  ? ` / ${formatDurationSeconds(weekTotals.plannedDuration)}`
                  : ''}
              </span>
            </div>
          </div>
        )}
      </header>

      {error && <p className="form-error">{error}</p>}

      <section className="home-races" aria-label="Races">
        <div className="home-section-header">
          <h2 className="trend-section-title">Races</h2>
          {!showForm && (
            <button type="button" className="primary" onClick={openCreate}>
              + Add race
            </button>
          )}
        </div>

        {featured ? (
          <div className="home-countdown">
            <p className="home-countdown-days">
              {featuredDays === 0 ? 'Race day' : `${featuredDays} day${featuredDays === 1 ? '' : 's'}`}
            </p>
            <p className="home-countdown-name">{featured.name}</p>
            <p className="home-countdown-meta">
              {formatRaceDate(featured.raceDate)}
              {featured.distance ? ` · ${featured.distance}` : ''}
              {` · ${PRIORITY_LABELS[featured.priority]} race`}
            </p>
          </div>
        ) : (
          <p className="empty-hint">
            Add the race you&apos;re training for to see a countdown here.
          </p>
        )}

        {showForm && (
          <form className="home-race-form" onSubmit={handleSave}>
            <h3>{editingId ? 'Edit race' : 'New race'}</h3>
            <label>
              Name
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ironman 70.3 Santa Cruz"
              />
            </label>
            <div className="form-row">
              <label>
                Date
                <input
                  required
                  type="date"
                  value={form.raceDate}
                  onChange={(e) => setForm((f) => ({ ...f, raceDate: e.target.value }))}
                />
              </label>
              <label>
                Priority
                <select
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))}
                >
                  <option value={1}>A — focus race</option>
                  <option value={2}>B — supporting</option>
                  <option value={3}>C — tune-up</option>
                </select>
              </label>
            </div>
            <label>
              Distance / type
              <input
                value={form.distance}
                onChange={(e) => setForm((f) => ({ ...f, distance: e.target.value }))}
                placeholder="70.3, Olympic, marathon…"
              />
            </label>
            <label>
              Notes
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Goal time, travel, taper notes…"
              />
            </label>
            <div className="form-actions">
              <button type="button" onClick={cancelForm} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="primary" disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Save' : 'Add race'}
              </button>
            </div>
          </form>
        )}

        {races.length > 0 && (
          <ul className="home-race-list">
            {races.map((race) => {
              const days = daysUntil(race.raceDate);
              const past = days < 0;
              return (
                <li key={race.id} className={past ? 'is-past' : ''}>
                  <div className="home-race-list-main">
                    <span className="home-race-priority">{PRIORITY_LABELS[race.priority]}</span>
                    <div>
                      <p className="home-race-list-name">{race.name}</p>
                      <p className="home-race-list-meta">
                        {formatRaceDate(race.raceDate)}
                        {race.distance ? ` · ${race.distance}` : ''}
                        {!past && ` · ${days === 0 ? 'today' : `${days}d`}`}
                        {past && ' · done'}
                      </p>
                    </div>
                  </div>
                  <div className="home-race-list-actions">
                    <button type="button" className="link-button" onClick={() => openEdit(race)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => setDeletingId(race.id)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {deletingId && (
        <ConfirmDialog
          title="Delete race?"
          message="This removes the race from your home countdown."
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeletingId(null)}
        />
      )}
    </div>
  );
}
