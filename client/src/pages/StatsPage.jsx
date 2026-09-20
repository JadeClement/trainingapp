import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { sportMeta, formatDurationSeconds, toISODate, addDays } from '../dateUtils.js';
import { MileageBarChart } from '../components/MileageBarChart.jsx';

const PERIODS = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'custom', label: 'Custom' },
];

const MIN_CUSTOM_DAYS = 1;
const MAX_CUSTOM_DAYS = 365;
const DEFAULT_CUSTOM_DAYS = 14;

function clampDays(value) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return DEFAULT_CUSTOM_DAYS;
  return Math.min(MAX_CUSTOM_DAYS, Math.max(MIN_CUSTOM_DAYS, n));
}

function parseDay(iso) {
  return new Date(`${iso}T00:00:00`);
}

function formatDayLabel(iso) {
  return parseDay(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function inclusiveDayCount(startIso, endIso) {
  return Math.round((parseDay(endIso) - parseDay(startIso)) / 86400000) + 1;
}

function formatRangeLabel(period, start, end) {
  const startDate = parseDay(start);
  const endDate = parseDay(end);
  if (period === 'year') return String(startDate.getFullYear());
  if (period === 'month') return startDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const opts = { month: 'short', day: 'numeric' };
  return `${startDate.toLocaleDateString(undefined, opts)} – ${endDate.toLocaleDateString(undefined, opts)}`;
}

function StatsRangeDate({ value, ariaLabel, onChange }) {
  const inputRef = useRef(null);

  function openPicker(e) {
    const input = inputRef.current;
    if (!input || e.target === input) return;
    try {
      input.showPicker();
    } catch {
      input.focus();
    }
  }

  return (
    <label className="stats-range-date" onClick={openPicker}>
      <span>{formatDayLabel(value)}</span>
      <input
        ref={inputRef}
        type="date"
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function shiftAnchor(date, period, direction, days) {
  const d = new Date(date);
  if (period === 'custom') d.setDate(d.getDate() + direction * days);
  else if (period === 'week') d.setDate(d.getDate() + direction * 7);
  else if (period === 'year') d.setFullYear(d.getFullYear() + direction);
  else d.setMonth(d.getMonth() + direction);
  return d;
}

export function StatsPage({ athleteId }) {
  const [period, setPeriod] = useState('week');
  const [customDays, setCustomDays] = useState(DEFAULT_CUSTOM_DAYS);
  const [daysDraft, setDaysDraft] = useState(String(DEFAULT_CUSTOM_DAYS));
  const [anchorDate, setAnchorDate] = useState(new Date());
  const [stats, setStats] = useState(null);
  const [selectedSport, setSelectedSport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const daysInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getStats(period, toISODate(anchorDate), athleteId, period === 'custom' ? customDays : undefined)
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
  }, [period, anchorDate, athleteId, customDays]);

  useEffect(() => {
    if (period === 'custom') daysInputRef.current?.focus();
  }, [period]);

  useEffect(() => {
    if (!stats?.sports?.length) {
      setSelectedSport(null);
      return;
    }
    setSelectedSport((current) => {
      if (current && stats.sports.some((s) => s.sport === current)) return current;
      const ranked = [...stats.sports].sort((a, b) => (b.distanceMeters || 0) - (a.distanceMeters || 0));
      return ranked[0].sport;
    });
  }, [stats]);

  function commitCustomDays() {
    const next = clampDays(daysDraft);
    setDaysDraft(String(next));
    setCustomDays(next);
  }

  function applyCustomBound(which, nextIso) {
    if (!nextIso) return;
    const currentEnd = stats?.end ?? toISODate(anchorDate);
    const currentStart = stats?.start ?? toISODate(addDays(anchorDate, -(customDays - 1)));
    let startIso = which === 'start' ? nextIso : currentStart;
    let endIso = which === 'end' ? nextIso : currentEnd;
    if (parseDay(startIso) > parseDay(endIso)) {
      const swap = startIso;
      startIso = endIso;
      endIso = swap;
    }
    let days = inclusiveDayCount(startIso, endIso);
    if (days > MAX_CUSTOM_DAYS) {
      if (which === 'start') {
        endIso = toISODate(addDays(parseDay(startIso), MAX_CUSTOM_DAYS - 1));
      } else {
        startIso = toISODate(addDays(parseDay(endIso), -(MAX_CUSTOM_DAYS - 1)));
      }
      days = MAX_CUSTOM_DAYS;
    }
    setCustomDays(days);
    setDaysDraft(String(days));
    setAnchorDate(parseDay(endIso));
  }

  return (
    <div className="stats-page">
      <div className="stats-toolbar">
        <div className="stats-period-controls">
          <div className="range-selector">
            {PERIODS.map((p) => (
              <button
                type="button"
                key={p.value}
                className={period === p.value ? 'active' : ''}
                onClick={() => {
                  setPeriod(p.value);
                  if (p.value === 'custom') setDaysDraft(String(customDays));
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          {period === 'custom' && (
            <label className="stats-custom-days">
              <input
                ref={daysInputRef}
                type="number"
                min={MIN_CUSTOM_DAYS}
                max={MAX_CUSTOM_DAYS}
                inputMode="numeric"
                value={daysDraft}
                onChange={(e) => setDaysDraft(e.target.value)}
                onBlur={commitCustomDays}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.currentTarget.blur();
                  }
                }}
                aria-label="Number of days"
              />
              days
            </label>
          )}
        </div>
        <div className="calendar-toolbar-nav">
          <button
            type="button"
            onClick={() => setAnchorDate((d) => shiftAnchor(d, period, -1, customDays))}
            aria-label="Previous"
          >
            ‹
          </button>
          <button type="button" onClick={() => setAnchorDate(new Date())}>
            Today
          </button>
          <button
            type="button"
            onClick={() => setAnchorDate((d) => shiftAnchor(d, period, 1, customDays))}
            aria-label="Next"
          >
            ›
          </button>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}
      {loading && <p className="page-loading">Loading…</p>}

      {!loading && stats && (
        <section className="settings-card">
          <h2 className="trend-section-title stats-range-title">
            {period === 'custom' ? (
              <>
                <span>{stats.days} days ·</span>
                <StatsRangeDate
                  value={stats.start}
                  ariaLabel="Range start"
                  onChange={(value) => applyCustomBound('start', value)}
                />
                <span aria-hidden="true">–</span>
                <StatsRangeDate
                  value={stats.end}
                  ariaLabel="Range end"
                  onChange={(value) => applyCustomBound('end', value)}
                />
              </>
            ) : (
              formatRangeLabel(stats.period, stats.start, stats.end)
            )}
            <span aria-hidden="true">·</span>
            <span>{formatDurationSeconds(stats.totals.durationSeconds)}</span>
          </h2>

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
                    <tr
                      key={s.sport}
                      className={`is-selectable${selectedSport === s.sport ? ' is-selected' : ''}`}
                      style={{ '--sport-color': sportMeta(s.sport).color }}
                      onClick={() => setSelectedSport(s.sport)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedSport(s.sport);
                        }
                      }}
                      tabIndex={0}
                      aria-selected={selectedSport === s.sport}
                    >
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

          {selectedSport && stats.series?.length > 0 && (
            <MileageBarChart
              series={stats.series}
              grain={stats.grain}
              sport={selectedSport}
              focusStart={stats.start}
              focusEnd={stats.end}
            />
          )}
        </section>
      )}
    </div>
  );
}
