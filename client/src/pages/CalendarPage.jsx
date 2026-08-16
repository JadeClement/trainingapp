import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { WeekLine } from '../components/WeekLine.jsx';
import { ClockIcon, RulerIcon } from '../components/icons.jsx';
import {
  toISODate,
  getWeekDays,
  getMonthGridDays,
  startOfMonth,
  addDays,
  sportMeta,
  formatDurationSeconds,
} from '../dateUtils.js';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const AUTO_SYNC_THROTTLE_MS = 5 * 60 * 1000;
const AUTO_SYNC_STORAGE_KEY = 'stravaLastAutoSync';

export function CalendarPage({ athleteId }) {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('week');
  const [anchorDate, setAnchorDate] = useState(new Date());
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const newWorkoutParams = athleteId ? `&athleteId=${athleteId}` : '';

  const days = useMemo(
    () => (viewMode === 'week' ? getWeekDays(anchorDate) : getMonthGridDays(anchorDate)),
    [viewMode, anchorDate]
  );

  const rangeStart = days[0];
  const rangeEnd = days[days.length - 1];

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listWorkouts(toISODate(rangeStart), toISODate(rangeEnd), athleteId);
      setWorkouts(data.workouts);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toISODate(rangeStart), toISODate(rangeEnd), athleteId]);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-sync from Strava whenever the app is opened or the tab regains
  // focus, so recent activities show up without a manual "Sync now" trip to
  // Settings. Throttled via localStorage (not sessionStorage, so it survives
  // reloads) rather than a one-shot flag, so a reload after a real gap
  // actually re-syncs, while rapid reloads/tab-switches don't spam Strava.
  // Skipped entirely when viewing an athlete's calendar as a coach — that
  // would sync the coach's own Strava account, not the athlete's.
  useEffect(() => {
    if (athleteId) return;
    function maybeSync() {
      const last = Number(localStorage.getItem(AUTO_SYNC_STORAGE_KEY) || 0);
      if (Date.now() - last < AUTO_SYNC_THROTTLE_MS) return;
      localStorage.setItem(AUTO_SYNC_STORAGE_KEY, String(Date.now()));

      api
        .stravaStatus()
        .then((status) => {
          if (!status.connected) return;
          return api.stravaSync().then(() => load());
        })
        .catch(() => {});
    }

    maybeSync();

    function handleVisibility() {
      if (document.visibilityState === 'visible') maybeSync();
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athleteId]);

  const workoutsByDate = useMemo(() => {
    const map = {};
    for (const w of workouts) {
      const key = w.scheduledDate;
      if (!map[key]) map[key] = [];
      map[key].push(w);
    }
    return map;
  }, [workouts]);

  function goPrev() {
    setAnchorDate((d) => addDays(d, viewMode === 'week' ? -7 : -30));
  }
  function goNext() {
    setAnchorDate((d) => addDays(d, viewMode === 'week' ? 7 : 30));
  }
  function goToday() {
    setAnchorDate(new Date());
  }

  function openWorkout(workout) {
    navigate(`/workouts/${workout.id}/detail`);
  }

  async function toggleComplete(workout) {
    try {
      if (workout.isCompleted) {
        await api.updateWorkout(workout.id, { isCompleted: false });
      } else {
        await api.completeWorkout(workout.id, {});
      }
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const monthLabel = anchorDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const currentMonth = startOfMonth(anchorDate).getMonth();
  const today = toISODate(new Date());

  return (
    <div className="calendar-page">
      <div className="calendar-toolbar">
        <div className="calendar-toolbar-nav">
          <button type="button" onClick={goPrev} aria-label="Previous">
            ‹
          </button>
          <button type="button" onClick={goToday}>
            Today
          </button>
          <button type="button" onClick={goNext} aria-label="Next">
            ›
          </button>
          <span className="calendar-label">{monthLabel}</span>
        </div>
        <div className="calendar-toolbar-actions">
          <div className="view-toggle">
            <button
              type="button"
              className={viewMode === 'week' ? 'active' : ''}
              onClick={() => setViewMode('week')}
            >
              Week
            </button>
            <button
              type="button"
              className={viewMode === 'month' ? 'active' : ''}
              onClick={() => setViewMode('month')}
            >
              Month
            </button>
          </div>
          <button
            type="button"
            className="primary"
            onClick={() => navigate(`/workouts/new${athleteId ? `?athleteId=${athleteId}` : ''}`)}
          >
            + New workout
          </button>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}
      {loading && <p className="page-loading">Loading…</p>}

      {viewMode === 'week' ? (
        <div className="week-view">
          <WeekLine
            days={days}
            workoutsByDate={workoutsByDate}
            onSelectDay={(date) => navigate(`/workouts/new?date=${date}${newWorkoutParams}`)}
          />
          {days.map((day) => {
            const key = toISODate(day);
            const dayWorkouts = workoutsByDate[key] || [];
            return (
              <div key={key} className={`week-day ${key === today ? 'is-today' : ''}`}>
                <div className="week-day-header">
                  <span>{WEEKDAY_LABELS[day.getDay()]}</span>
                  <span className="week-day-date">{day.getDate()}</span>
                  <button
                    type="button"
                    className="link-button"
                    aria-label={`Add workout on ${key}`}
                    onClick={() => navigate(`/workouts/new?date=${key}${newWorkoutParams}`)}
                  >
                    +
                  </button>
                </div>
                <div className="week-day-workouts">
                  {dayWorkouts.length === 0 && <p className="empty-hint">No workouts</p>}
                  {dayWorkouts.map((w) => (
                    <WorkoutRow key={w.id} workout={w} onToggle={() => toggleComplete(w)} onOpen={() => openWorkout(w)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="month-view">
          <div className="month-grid-header">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label}>{label}</div>
            ))}
          </div>
          <div className="month-grid">
            {days.map((day) => {
              const key = toISODate(day);
              const dayWorkouts = workoutsByDate[key] || [];
              const inMonth = day.getMonth() === currentMonth;
              return (
                <div
                  key={key}
                  className={`month-cell ${inMonth ? '' : 'is-outside'} ${key === today ? 'is-today' : ''}`}
                  onClick={() => navigate(`/workouts/new?date=${key}${newWorkoutParams}`)}
                >
                  <span className="month-cell-date">{day.getDate()}</span>
                  <div className="month-cell-chips">
                    {dayWorkouts.map((w) => {
                      const meta = sportMeta(w.sport);
                      const duration = formatDurationSeconds(w.actualDurationSeconds ?? w.plannedDurationSeconds);
                      const distance = w.details?.distance;
                      return (
                        <div
                          key={w.id}
                          className="chip"
                          style={{ backgroundColor: meta.color }}
                          title={w.title}
                          onClick={(e) => {
                            e.stopPropagation();
                            openWorkout(w);
                          }}
                        >
                          <div className="chip-title">
                            {w.isCompleted ? '✓ ' : ''}
                            {w.title}
                          </div>
                          {(duration || distance) && (
                            <div className="chip-meta">
                              {duration && (
                                <span className="chip-meta-item">
                                  <ClockIcon /> {duration}
                                </span>
                              )}
                              {distance && (
                                <span className="chip-meta-item">
                                  <RulerIcon /> {distance}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function WorkoutRow({ workout, onToggle, onOpen }) {
  const meta = sportMeta(workout.sport);
  const label = workout.details?.activityType || meta.label;
  const duration = formatDurationSeconds(workout.actualDurationSeconds ?? workout.plannedDurationSeconds);
  const distance = workout.details?.distance;

  return (
    <div className={`workout-row ${workout.isCompleted ? 'is-completed' : ''}`}>
      <span className="sport-dot" style={{ backgroundColor: meta.color }} />
      <button type="button" className="workout-row-main" onClick={onOpen}>
        <span className="workout-row-title">{workout.title}</span>
        <span className="workout-row-meta">
          {label}
          {duration ? ` · ${duration}` : ''}
          {distance ? ` · ${distance}` : ''}
        </span>
      </button>
      <button type="button" className="complete-toggle" onClick={onToggle} aria-label="Toggle complete">
        {workout.isCompleted ? '✓' : '○'}
      </button>
    </div>
  );
}
