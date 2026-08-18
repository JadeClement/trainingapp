import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { api } from '../api.js';
import { SPORTS, sportMeta, toISODate } from '../dateUtils.js';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import { ActivityTypePicker } from '../components/ActivityTypePicker.jsx';

const QUICK_SPORTS = SPORTS.filter((s) => s.value !== 'other');

const VISIBILITIES = [
  { value: 'hidden', label: 'Only me' },
  { value: 'close_friends', label: 'Close friends' },
  { value: 'everyone', label: 'Everyone' },
];

function secondsToMinutesStr(seconds) {
  if (seconds === null || seconds === undefined) return '';
  return String(Math.round(seconds / 60));
}

function minutesStrToSeconds(str) {
  if (str === '' || str === null || str === undefined) return null;
  const mins = Number(str);
  if (Number.isNaN(mins)) return null;
  return Math.round(mins * 60);
}

export function WorkoutFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);
  const athleteId = searchParams.get('athleteId');

  const [sport, setSport] = useState('run');
  const [activityType, setActivityType] = useState('');
  const [showActivityPicker, setShowActivityPicker] = useState(false);
  const [title, setTitle] = useState('');
  const [scheduledDate, setScheduledDate] = useState(searchParams.get('date') || toISODate(new Date()));
  const [plannedMinutes, setPlannedMinutes] = useState('');
  const [actualMinutes, setActualMinutes] = useState('');
  const [notes, setNotes] = useState('');
  const [distance, setDistance] = useState('');
  const [visibility, setVisibility] = useState('hidden');
  const [isCompleted, setIsCompleted] = useState(false);
  const [source, setSource] = useState('manual');
  const [stravaActivityId, setStravaActivityId] = useState(null);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!isEditing) return;
    api
      .getWorkout(id)
      .then((data) => {
        const w = data.workout;
        setSport(w.sport);
        setActivityType(w.details?.activityType || '');
        setTitle(w.title);
        setScheduledDate(w.scheduledDate);
        setPlannedMinutes(secondsToMinutesStr(w.plannedDurationSeconds));
        setActualMinutes(secondsToMinutesStr(w.actualDurationSeconds));
        setNotes(w.notes || '');
        setDistance(w.details?.distance || '');
        setVisibility(w.visibility);
        setIsCompleted(w.isCompleted);
        setSource(w.source);
        setStravaActivityId(w.stravaActivityId);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, isEditing]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload = {
      sport,
      title,
      scheduledDate,
      notes: notes || null,
      visibility,
      plannedDurationSeconds: minutesStrToSeconds(plannedMinutes),
      actualDurationSeconds: minutesStrToSeconds(actualMinutes),
      isCompleted,
      details: {
        ...(distance ? { distance } : {}),
        ...(activityType ? { activityType } : {}),
      },
    };

    try {
      let savedWorkout;
      if (isEditing) {
        const data = await api.updateWorkout(id, payload);
        savedWorkout = data.workout;
      } else {
        const data = await api.createWorkout(payload, athleteId);
        savedWorkout = data.workout;
      }
      navigate(`/workouts/${savedWorkout.id}/detail`, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setConfirmingDelete(false);
    setSaving(true);
    try {
      await api.deleteWorkout(id);
      navigate('/');
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  if (loading) return <p className="page-loading">Loading…</p>;

  const isSynced = source === 'strava_synced';

  return (
    <div className="workout-form-page">
      <form className="workout-form" onSubmit={handleSubmit}>
        <h1>{isEditing ? 'Edit workout' : 'New workout'}</h1>
        {error && <p className="form-error">{error}</p>}

        {isSynced && (
          <p className="banner banner-info">
            Synced from Strava — the date updates automatically on sync, but the title is yours
            once you change it.{' '}
            <Link to={`/workouts/${id}/detail`}>View charts</Link>{' · '}
            <a
              href={`https://www.strava.com/activities/${stravaActivityId}`}
              target="_blank"
              rel="noreferrer"
            >
              View on Strava
            </a>
          </p>
        )}

        <div className="sport-picker">
          {QUICK_SPORTS.map((s) => (
            <button
              type="button"
              key={s.value}
              className={`sport-option ${!activityType && sport === s.value ? 'active' : ''}`}
              style={{ '--sport-color': s.color }}
              onClick={() => {
                setSport(s.value);
                setActivityType('');
              }}
            >
              {s.label}
            </button>
          ))}
          <button
            type="button"
            className={`sport-option sport-option-more ${activityType ? 'active' : ''}`}
            style={activityType ? { '--sport-color': sportMeta(sport).color } : undefined}
            onClick={() => setShowActivityPicker(true)}
          >
            {activityType || '+ More'}
          </button>
        </div>

        <label>
          Title
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Easy 5k, Interval bike"
            required
            autoFocus
          />
        </label>

        <div className="form-row">
          <label>
            Date
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              required
              disabled={isSynced}
            />
          </label>
          <label>
            Planned (min)
            <input
              type="number"
              min="0"
              value={plannedMinutes}
              onChange={(e) => setPlannedMinutes(e.target.value)}
              placeholder="45"
            />
          </label>
        </div>

        {isEditing && (
          <div className="form-row">
            <label>
              Actual (min)
              <input
                type="number"
                min="0"
                value={actualMinutes}
                onChange={(e) => setActualMinutes(e.target.value)}
                placeholder="45"
              />
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={isCompleted}
                onChange={(e) => setIsCompleted(e.target.checked)}
              />
              Completed
            </label>
          </div>
        )}

        <label>
          Distance <span className="label-hint">(optional, any unit)</span>
          <input
            type="text"
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
            placeholder="e.g. 10km, 1500m"
          />
        </label>

        <label>
          Visibility
          <select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
            {VISIBILITIES.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </label>

        <div className="form-actions">
          <button type="submit" className="primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.history.state?.idx > 0) navigate(-1);
              else navigate('/');
            }}
            disabled={saving}
          >
            Cancel
          </button>
          {isEditing && (
            <button
              type="button"
              className="danger"
              onClick={() => setConfirmingDelete(true)}
              disabled={saving}
            >
              Delete
            </button>
          )}
        </div>
      </form>

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete workout?"
          message={`This will permanently delete "${title}". This can't be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}

      {showActivityPicker && (
        <ActivityTypePicker
          onSelect={({ sport: pickedSport, activityType: pickedType }) => {
            setSport(pickedSport);
            setActivityType(pickedType);
            if (!title) setTitle(pickedType);
            setShowActivityPicker(false);
          }}
          onClose={() => setShowActivityPicker(false)}
        />
      )}
    </div>
  );
}
