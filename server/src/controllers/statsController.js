import pool from '../db/pool.js';

const SPORTS = ['swim', 'bike', 'run', 'strength', 'other'];
const PERIODS = ['week', 'month', 'year', 'custom'];
const MIN_CUSTOM_DAYS = 1;
const MAX_CUSTOM_DAYS = 365;
const DEFAULT_CUSTOM_DAYS = 14;

// details.distance is a free-text label ("85.0km", "1500m", ...) written by
// either the Strava sync or a user typing into the manual distance field —
// parse it back to meters so totals can be summed across workouts.
function parseDistanceMeters(distance) {
  if (!distance) return 0;
  const match = String(distance).trim().match(/^([\d.]+)\s*(km|mi|m)$/i);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === 'km') return value * 1000;
  if (unit === 'mi') return value * 1609.34;
  return value;
}

function formatDistanceMeters(sport, meters) {
  if (!meters) return null;
  if (sport === 'swim') return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

function toDateString(d) {
  return d.toISOString().slice(0, 10);
}

function parseCustomDays(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_CUSTOM_DAYS;
  return Math.min(MAX_CUSTOM_DAYS, Math.max(MIN_CUSTOM_DAYS, Math.round(n)));
}

// Matches the viewer's week-start preference (see client dateUtils.js
// startOfWeek) so this page's "week" lines up with the calendar's. `anchor`
// is whatever date the caller is currently looking at — defaults to today,
// but paging back/forward moves it to an earlier/later week, month, year,
// or custom window.
function periodBounds(period, anchor, weekStartsOn = 'monday', days = DEFAULT_CUSTOM_DAYS) {
  if (period === 'custom') {
    const end = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
    const start = new Date(end);
    start.setDate(start.getDate() - (days - 1));
    return { start, end };
  }

  if (period === 'week') {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
    const day = start.getDay(); // 0 = Sunday
    const offset = weekStartsOn === 'sunday' ? day : (day + 6) % 7;
    start.setDate(start.getDate() - offset);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { start, end };
  }

  if (period === 'year') {
    return { start: new Date(anchor.getFullYear(), 0, 1), end: new Date(anchor.getFullYear(), 11, 31) };
  }

  return {
    start: new Date(anchor.getFullYear(), anchor.getMonth(), 1),
    end: new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0),
  };
}

function parseAnchorDate(value) {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function toLocalDateString(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addCalendarDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function startOfWeekDate(date, weekStartsOn) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = start.getDay();
  const offset = weekStartsOn === 'sunday' ? day : (day + 6) % 7;
  start.setDate(start.getDate() - offset);
  return start;
}

function clipDate(date, min, max) {
  if (date < min) return new Date(min);
  if (date > max) return new Date(max);
  return new Date(date);
}

// Week view is daily, month is weekly, year is monthly. Custom windows pick
// the grain that keeps the bar chart readable as the range grows.
function seriesGrain(period, days) {
  if (period === 'year') return 'month';
  if (period === 'month') return 'week';
  if (period === 'custom') {
    if (days > 90) return 'month';
    if (days > 14) return 'week';
  }
  return 'day';
}

function emptyDistances() {
  return Object.fromEntries(SPORTS.map((sport) => [sport, 0]));
}

function buildSeriesBuckets(grain, start, end, weekStartsOn) {
  const rangeStart = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const rangeEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const buckets = [];

  if (grain === 'month') {
    let cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
    while (cursor <= rangeEnd) {
      const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      buckets.push({
        start: toLocalDateString(clipDate(cursor, rangeStart, rangeEnd)),
        end: toLocalDateString(clipDate(monthEnd, rangeStart, rangeEnd)),
      });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
    return buckets;
  }

  if (grain === 'week') {
    let cursor = startOfWeekDate(rangeStart, weekStartsOn);
    while (cursor <= rangeEnd) {
      const weekEnd = addCalendarDays(cursor, 6);
      const bucketStart = clipDate(cursor, rangeStart, rangeEnd);
      const bucketEnd = clipDate(weekEnd, rangeStart, rangeEnd);
      if (bucketStart <= rangeEnd && bucketEnd >= rangeStart) {
        buckets.push({ start: toLocalDateString(bucketStart), end: toLocalDateString(bucketEnd) });
      }
      cursor = addCalendarDays(cursor, 7);
    }
    return buckets;
  }

  let cursor = rangeStart;
  while (cursor <= rangeEnd) {
    const key = toLocalDateString(cursor);
    buckets.push({ start: key, end: key });
    cursor = addCalendarDays(cursor, 1);
  }
  return buckets;
}

// GET /api/stats?period=week|month|year|custom&date=YYYY-MM-DD[&days=]
// Per-sport totals for the week/month/year containing `date`, or the
// trailing `days` ending on `date` when period=custom. Completed workouts
// only (what was actually done, not what's planned). Also returns a
// `series` of distance buckets: daily for week, weekly for month, monthly
// for year (custom picks a grain from the window length).
export async function getStats(req, res) {
  const period = PERIODS.includes(req.query.period) ? req.query.period : 'week';
  const days = parseCustomDays(req.query.days);
  const anchor = parseAnchorDate(req.query.date);
  const pref = await pool.query('SELECT week_starts_on FROM users WHERE id = $1', [req.userId]);
  const weekStartsOn = pref.rows[0]?.week_starts_on === 'sunday' ? 'sunday' : 'monday';
  const { start, end } = periodBounds(period, anchor, weekStartsOn, days);

  const result = await pool.query(
    `SELECT sport, actual_duration_seconds, details, scheduled_date::text AS scheduled_date
     FROM workouts
     WHERE user_id = $1 AND is_completed = true
       AND scheduled_date BETWEEN $2 AND $3`,
    [req.targetUserId, toDateString(start), toDateString(end)]
  );

  const bySport = new Map(SPORTS.map((sport) => [sport, { sport, durationSeconds: 0, distanceMeters: 0, workoutCount: 0 }]));
  const grain = seriesGrain(period, days);
  const series = buildSeriesBuckets(grain, start, end, weekStartsOn).map((bucket) => ({
    ...bucket,
    distances: emptyDistances(),
  }));

  for (const row of result.rows) {
    if (row.sport === 'rest') continue;
    if (!bySport.has(row.sport)) {
      bySport.set(row.sport, { sport: row.sport, durationSeconds: 0, distanceMeters: 0, workoutCount: 0 });
    }
    const meters = parseDistanceMeters(row.details?.distance);
    const bucket = bySport.get(row.sport);
    bucket.durationSeconds += row.actual_duration_seconds || 0;
    bucket.distanceMeters += meters;
    bucket.workoutCount += 1;

    const idx = series.findIndex((b) => row.scheduled_date >= b.start && row.scheduled_date <= b.end);
    if (idx >= 0) {
      series[idx].distances[row.sport] = (series[idx].distances[row.sport] || 0) + meters;
    }
  }

  const sports = [...bySport.values()]
    .filter((s) => s.workoutCount > 0)
    .sort((a, b) => b.durationSeconds - a.durationSeconds)
    .map((s) => ({
      sport: s.sport,
      durationSeconds: s.durationSeconds,
      distanceMeters: s.distanceMeters,
      distance: formatDistanceMeters(s.sport, s.distanceMeters),
      workoutCount: s.workoutCount,
    }));

  const totals = sports.reduce(
    (acc, s) => ({
      durationSeconds: acc.durationSeconds + s.durationSeconds,
      workoutCount: acc.workoutCount + s.workoutCount,
    }),
    { durationSeconds: 0, workoutCount: 0 }
  );

  res.json({
    period,
    grain,
    days: period === 'custom' ? days : undefined,
    start: toDateString(start),
    end: toDateString(end),
    sports,
    totals,
    series,
  });
}
