import pool from '../db/pool.js';
import {
  DEFAULT_FEATURED_SPORTS,
  displayKeyForWorkout,
  formatSportForDistance,
  pinKey,
} from '../services/activityTypes.js';

const SPORTS = ['swim', 'bike', 'run', 'strength', 'other'];
const PERIODS = ['week', 'month', 'year', 'custom'];
const MIN_CUSTOM_DAYS = 1;
const MAX_CUSTOM_DAYS = 365;
const DEFAULT_CUSTOM_DAYS = 14;

// details.distance is a free-text label ("85.0km", "1.500km", ...) written by
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
  const km = meters / 1000;
  if (sport === 'swim') return `${km.toFixed(3)}km`;
  return `${km.toFixed(1)}km`;
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

const SERIES_WEEK_COUNT = 12;
const SERIES_MONTH_COUNT = 12;
const SERIES_YEAR_COUNT = 6;

// Chart grain matches the period control: week/month/year each plot that
// unit. Custom windows pick a grain that stays readable as the range grows.
function seriesGrain(period, days) {
  if (period === 'year') return 'year';
  if (period === 'month') return 'month';
  if (period === 'week') return 'week';
  if (period === 'custom') {
    if (days > 90) return 'month';
    if (days > 14) return 'week';
  }
  return 'day';
}

// Table totals stay on the selected period; the chart looks further back so
// it has more than one bar of that grain.
function seriesBounds(period, start, end) {
  if (period === 'week') {
    return { start: addCalendarDays(start, -7 * (SERIES_WEEK_COUNT - 1)), end: new Date(end) };
  }
  if (period === 'month') {
    return {
      start: new Date(start.getFullYear(), start.getMonth() - (SERIES_MONTH_COUNT - 1), 1),
      end: new Date(end),
    };
  }
  if (period === 'year') {
    const year = start.getFullYear();
    return {
      start: new Date(year - (SERIES_YEAR_COUNT - 1), 0, 1),
      end: new Date(year, 11, 31),
    };
  }
  return { start: new Date(start), end: new Date(end) };
}

function emptyDistances(keys = SPORTS) {
  return Object.fromEntries(keys.map((sport) => [sport, 0]));
}

function buildSeriesBuckets(grain, start, end, weekStartsOn) {
  const rangeStart = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const rangeEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const buckets = [];

  if (grain === 'year') {
    let cursor = new Date(rangeStart.getFullYear(), 0, 1);
    while (cursor.getFullYear() <= rangeEnd.getFullYear()) {
      const yearEnd = new Date(cursor.getFullYear(), 11, 31);
      buckets.push({
        start: toLocalDateString(clipDate(cursor, rangeStart, rangeEnd)),
        end: toLocalDateString(clipDate(yearEnd, rangeStart, rangeEnd)),
      });
      cursor = new Date(cursor.getFullYear() + 1, 0, 1);
    }
    return buckets;
  }

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
// `series` of distance buckets at that same grain (week/month/year), looking
// further back so the chart has multiple bars. Custom picks a grain from
// the window length.
export async function getStats(req, res) {
  const period = PERIODS.includes(req.query.period) ? req.query.period : 'week';
  const days = parseCustomDays(req.query.days);
  const anchor = parseAnchorDate(req.query.date);
  const pref = await pool.query('SELECT week_starts_on FROM users WHERE id = $1', [req.userId]);
  const weekStartsOn = pref.rows[0]?.week_starts_on === 'sunday' ? 'sunday' : 'monday';

  // Sport display prefs belong to the athlete whose workouts we're aggregating.
  const athletePref = await pool.query(
    `SELECT featured_sports, pinned_activity_types FROM users WHERE id = $1`,
    [req.targetUserId]
  );
  const featuredSports = athletePref.rows[0]?.featured_sports?.length
    ? athletePref.rows[0].featured_sports
    : [...DEFAULT_FEATURED_SPORTS];
  const pinnedActivityTypes = athletePref.rows[0]?.pinned_activity_types ?? [];
  const seriesKeys = [...featuredSports, ...pinnedActivityTypes.map((type) => pinKey(type))];
  if (!seriesKeys.includes('other')) seriesKeys.push('other');

  const { start, end } = periodBounds(period, anchor, weekStartsOn, days);
  const grain = seriesGrain(period, days);
  const { start: seriesStart, end: seriesEnd } = seriesBounds(period, start, end);
  const periodStart = toDateString(start);
  const periodEnd = toDateString(end);

  const result = await pool.query(
    `SELECT sport, actual_duration_seconds, details, scheduled_date::text AS scheduled_date
     FROM workouts
     WHERE user_id = $1 AND is_completed = true
       AND scheduled_date BETWEEN $2 AND $3`,
    [req.targetUserId, toDateString(seriesStart), toDateString(seriesEnd)]
  );

  const bySport = new Map(
    seriesKeys.map((sport) => [sport, { sport, durationSeconds: 0, distanceMeters: 0, workoutCount: 0 }])
  );
  const series = buildSeriesBuckets(grain, seriesStart, seriesEnd, weekStartsOn).map((bucket) => ({
    ...bucket,
    distances: emptyDistances(seriesKeys),
  }));

  for (const row of result.rows) {
    if (row.sport === 'rest') continue;
    const key = displayKeyForWorkout(row, featuredSports, pinnedActivityTypes);
    const meters = parseDistanceMeters(row.details?.distance);
    const inPeriod = row.scheduled_date >= periodStart && row.scheduled_date <= periodEnd;
    if (inPeriod) {
      if (!bySport.has(key)) {
        bySport.set(key, { sport: key, durationSeconds: 0, distanceMeters: 0, workoutCount: 0 });
      }
      const bucket = bySport.get(key);
      bucket.durationSeconds += row.actual_duration_seconds || 0;
      bucket.distanceMeters += meters;
      bucket.workoutCount += 1;
    }

    const idx = series.findIndex((b) => row.scheduled_date >= b.start && row.scheduled_date <= b.end);
    if (idx >= 0) {
      series[idx].distances[key] = (series[idx].distances[key] || 0) + meters;
    }
  }

  const sports = [...bySport.values()]
    .filter((s) => s.workoutCount > 0)
    .sort((a, b) => b.durationSeconds - a.durationSeconds)
    .map((s) => ({
      sport: s.sport,
      durationSeconds: s.durationSeconds,
      distanceMeters: s.distanceMeters,
      distance: formatDistanceMeters(formatSportForDistance(s.sport), s.distanceMeters),
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
