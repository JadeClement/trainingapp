// Turns Strava's raw velocity_smooth (m/s) into a per-sport, per-point chart
// value. Points below a "not really moving" floor (or explicitly paused per
// the 'moving' stream) are nulled out so brief stops don't spike pace to
// absurd values and skew the chart's scale.
const MIN_MOVING_MPS = 0.3;

export function paceOrSpeedSeries(sport, velocity, moving) {
  return velocity.map((v, i) => {
    if (v === null || v === undefined) return null;
    if (moving && moving[i] === false) return null;
    if (v < MIN_MOVING_MPS) return null;
    return velocityToValue(sport, v);
  });
}

export function velocityToValue(sport, mps) {
  if (sport === 'bike') return mps * 3.6; // km/h — higher is faster, charted as-is
  if (sport === 'swim') return 100 / mps / 60; // min per 100m
  return 1000 / mps / 60; // min per km (run and everything else)
}

export function paceOrSpeedUnit(sport) {
  if (sport === 'bike') return { label: 'Speed', unit: 'km/h', fasterIsLower: false };
  if (sport === 'swim') return { label: 'Pace', unit: '/100m', fasterIsLower: true };
  return { label: 'Pace', unit: '/km', fasterIsLower: true };
}

export function formatPaceOrSpeed(sport, value) {
  if (value === null || value === undefined) return '—';
  if (sport === 'bike') return `${value.toFixed(1)} km/h`;
  const mins = Math.floor(value);
  const secs = Math.round((value - mins) * 60);
  const suffix = sport === 'swim' ? '/100m' : '/km';
  return `${mins}:${String(secs).padStart(2, '0')}${suffix}`;
}

export function average(values) {
  const valid = values.filter((v) => v !== null && v !== undefined && !Number.isNaN(v));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

export function maxValue(values) {
  const valid = values.filter((v) => v !== null && v !== undefined && !Number.isNaN(v));
  if (valid.length === 0) return null;
  return Math.max(...valid);
}

export function minValue(values) {
  const valid = values.filter((v) => v !== null && v !== undefined && !Number.isNaN(v));
  if (valid.length === 0) return null;
  return Math.min(...valid);
}

// Total ascent — the number endurance athletes actually care about, rather
// than raw average/max altitude (which mostly just reflects the start point).
export function elevationGain(altitude) {
  let gain = 0;
  for (let i = 1; i < altitude.length; i++) {
    const a = altitude[i - 1];
    const b = altitude[i];
    if (a === null || b === null || a === undefined || b === undefined) continue;
    if (b > a) gain += b - a;
  }
  return gain;
}

// Standard %-of-max-HR five-zone model.
const ZONE_DEFS = [
  { key: 'z1', label: 'Zone 1', from: 0, to: 0.6, color: 'var(--hr-zone-1)' },
  { key: 'z2', label: 'Zone 2', from: 0.6, to: 0.7, color: 'var(--hr-zone-2)' },
  { key: 'z3', label: 'Zone 3', from: 0.7, to: 0.8, color: 'var(--hr-zone-3)' },
  { key: 'z4', label: 'Zone 4', from: 0.8, to: 0.9, color: 'var(--hr-zone-4)' },
  { key: 'z5', label: 'Zone 5', from: 0.9, to: 1.2, color: 'var(--hr-zone-5)' },
];

export function hrZoneBands(maxHr) {
  if (!maxHr) return [];
  return ZONE_DEFS.map((z) => ({
    ...z,
    from: Math.round(maxHr * z.from),
    to: Math.round(maxHr * z.to),
  }));
}

// Tick values are always exact minute multiples (5, 10, 20, ...), so there's
// never a meaningful seconds component to show.
export function formatTickMinutes(seconds) {
  return `${Math.round(seconds / 60)}m`;
}

// Round tick spacing (minutes) picked so a chart never shows more than ~8
// ticks: short workouts get 5-minute marks, long ones get coarser marks.
const TICK_INTERVAL_MINUTES = [5, 10, 15, 20, 30, 60, 90, 120];

function pickTickIntervalSeconds(totalSeconds) {
  const totalMinutes = totalSeconds / 60;
  const interval = TICK_INTERVAL_MINUTES.find((mins) => totalMinutes / mins <= 8);
  return (interval ?? TICK_INTERVAL_MINUTES[TICK_INTERVAL_MINUTES.length - 1]) * 60;
}

export function nearestIndex(time, target) {
  let lo = 0;
  let hi = time.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (time[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// Recording density isn't always uniform per second (e.g. fewer samples
// during a stop), so evenly-spaced time values can land close together in
// index space. Drop ticks that would crowd their neighbor, always keeping
// the true end point rather than a near-duplicate just before it.
const MIN_TICK_GAP_PCT = 7;

function dedupeByPosition(ticks) {
  if (ticks.length === 0) return ticks;
  const kept = [ticks[0]];

  for (let i = 1; i < ticks.length; i++) {
    const tick = ticks[i];
    const isLast = i === ticks.length - 1;
    const prev = kept[kept.length - 1];

    if (tick.pct - prev.pct < MIN_TICK_GAP_PCT) {
      if (isLast) kept[kept.length - 1] = tick;
    } else {
      kept.push(tick);
    }
  }

  return kept;
}

// Ticks at round time intervals (e.g. every 5, 10, or 20 minutes depending
// on how long the workout is), each mapped to the closest actual sample
// index so it lines up with the chart's index-based x-scale.
export function timeAxisTicks(time) {
  if (!time || time.length === 0) return [];
  const total = time[time.length - 1];
  const interval = pickTickIntervalSeconds(total);
  const lastIndex = time.length - 1;

  const ticks = [];
  for (let t = 0; t <= total; t += interval) {
    const index = nearestIndex(time, t);
    ticks.push({ index, seconds: t, pct: (index / lastIndex) * 100 });
  }

  return dedupeByPosition(ticks);
}
