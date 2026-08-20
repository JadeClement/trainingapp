import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { sportMeta, formatDurationSeconds, toISODate } from '../dateUtils.js';

const PERIODS = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
];

function formatRangeLabel(period, start, end) {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  if (period === 'year') return String(startDate.getFullYear());
  if (period === 'month') return startDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const opts = { month: 'short', day: 'numeric' };
  return `${startDate.toLocaleDateString(undefined, opts)} – ${endDate.toLocaleDateString(undefined, opts)}`;
}

function shiftAnchor(date, period, direction) {
  const d = new Date(date);
  if (period === 'week') d.setDate(d.getDate() + direction * 7);
  else if (period === 'year') d.setFullYear(d.getFullYear() + direction);
  else d.setMonth(d.getMonth() + direction);
  return d;
}

export function StatsPage({ athleteId }) {
  const [period, setPeriod] = useState('week');
  const [anchorDate, setAnchorDate] = useState(new Date());
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getStats(period, toISODate(anchorDate), athleteId)
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period, anchorDate, athleteId]);

  return (
    <div className="stats-page">
      <div className="stats-toolbar">
        <div className="range-selector">
          {PERIODS.map((p) => (
            <button
              type="button"
              key={p.value}
              className={period === p.value ? 'active' : ''}
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="calendar-toolbar-nav">
          <button type="button" onClick={() => setAnchorDate((d) => shiftAnchor(d, period, -1))} aria-label="Previous">
            ‹
          </button>
          <button type="button" onClick={() => setAnchorDate(new Date())}>
            Today
          </button>
          <button type="button" onClick={() => setAnchorDate((d) => shiftAnchor(d, period, 1))} aria-label="Next">
            ›
          </button>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}
      {loading && <p className="page-loading">Loading…</p>}

      {!loading && stats && (
        <section className="settings-card">
          <h2 className="trend-section-title">{formatRangeLabel(stats.period, stats.start, stats.end)}</h2>

          {stats.sports.length === 0 ? (
            <p className="empty-hint">No completed workouts in this period.</p>
          ) : (
            <div className="laps-table-wrap">
              <table className="laps-table">
                <thead>
                  <tr>
                    <th>Sport</th>
                    <th>Duration</th>
                    <th>Distance</th>
                    <th>Workouts</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.sports.map((s) => (
                    <tr key={s.sport}>
                      <td>
                        <span className="stats-sport-label">
                          <i className="stats-sport-dot" style={{ backgroundColor: sportMeta(s.sport).color }} />
                          {sportMeta(s.sport).label}
                        </span>
                      </td>
                      <td>{formatDurationSeconds(s.durationSeconds)}</td>
                      <td>{s.distance || '—'}</td>
                      <td>{s.workoutCount}</td>
                    </tr>
                  ))}
                  <tr className="stats-totals-row">
                    <td>Total</td>
                    <td>{formatDurationSeconds(stats.totals.durationSeconds)}</td>
                    <td>—</td>
                    <td>{stats.totals.workoutCount}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
