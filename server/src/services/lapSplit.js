function num(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function httpError(status, publicMessage) {
  const err = new Error(publicMessage);
  err.status = status;
  err.publicMessage = publicMessage;
  return err;
}

function asArray(stream) {
  if (!stream) return null;
  if (Array.isArray(stream)) return stream;
  if (Array.isArray(stream.data)) return stream.data;
  return null;
}

function avg(arr, start, end) {
  if (!arr) return null;
  let sum = 0;
  let n = 0;
  for (let i = start; i < end; i++) {
    const v = num(arr[i]);
    if (v === null) continue;
    sum += v;
    n += 1;
  }
  return n ? sum / n : null;
}

function maxIn(arr, start, end) {
  if (!arr) return null;
  let max = null;
  for (let i = start; i < end; i++) {
    const v = num(arr[i]);
    if (v === null) continue;
    max = max === null ? v : Math.max(max, v);
  }
  return max;
}

function elevationGain(altitude, start, end) {
  if (!altitude) return null;
  let gain = 0;
  let sawPair = false;
  for (let i = start + 1; i < end; i++) {
    const a = num(altitude[i - 1]);
    const b = num(altitude[i]);
    if (a === null || b === null) continue;
    sawPair = true;
    if (b > a) gain += b - a;
  }
  return sawPair ? gain : null;
}

function distanceDelta(distance, start, end) {
  if (!distance) return null;
  let first = null;
  let last = null;
  for (let i = start; i < end; i++) {
    const v = num(distance[i]);
    if (v === null) continue;
    if (first === null) first = v;
    last = v;
  }
  if (first === null || last === null) return null;
  return Math.max(0, last - first);
}

function movingSeconds(time, moving, start, end) {
  if (end - start < 2) return 0;
  let seconds = 0;
  for (let i = start; i < end - 1; i++) {
    const dt = num(time[i + 1]) - num(time[i]);
    if (!Number.isFinite(dt) || dt < 0) continue;
    if (moving && moving[i] === false) continue;
    seconds += dt;
  }
  return seconds;
}

function addSecondsIso(iso, seconds) {
  if (!iso || !Number.isFinite(seconds)) return iso || null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Date(d.getTime() + seconds * 1000).toISOString();
}

function rangeStats(streams, start, end, elapsed) {
  const time = asArray(streams.time);
  const moving = asArray(streams.moving);
  const distance = distanceDelta(asArray(streams.distance), start, end);
  const movingTime = time ? movingSeconds(time, moving, start, end) : elapsed;
  const speedTime = movingTime || elapsed;

  return {
    elapsed_time: elapsed,
    moving_time: movingTime ? Math.round(movingTime) : elapsed,
    distance,
    total_elevation_gain: elevationGain(asArray(streams.altitude), start, end),
    average_speed: num(distance) !== null && speedTime ? distance / speedTime : null,
    max_speed: maxIn(asArray(streams.velocity_smooth), start, end),
    average_heartrate: avg(asArray(streams.heartrate), start, end),
    max_heartrate: maxIn(asArray(streams.heartrate), start, end),
    average_cadence: avg(asArray(streams.cadence), start, end),
    average_watts: avg(asArray(streams.watts), start, end),
    max_watts: maxIn(asArray(streams.watts), start, end),
    start_index: start,
    end_index: Math.max(start, end - 1),
  };
}

// Same lower-bound search as the client chart dividers, so a split lands
// on the parked cursor rather than a neighboring sample.
function nearestIndex(time, target) {
  let lo = 0;
  let hi = time.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (time[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export const MIN_SPLIT_GAP_SEC = 3;

// Split the interval that contains `splitSeconds` (elapsed from activity
// start — same clock the chart cursor uses) into two, recomputing stats
// from streams so each new row has its own avg/max rather than inheriting
// the parent lap's.
export function splitLapsAtElapsed(laps, splitSeconds, streams) {
  const time = asArray(streams?.time);
  if (!time || time.length < 4) {
    throw httpError(400, 'Need recorded time data to add an interval');
  }
  if (!Number.isFinite(splitSeconds)) {
    throw httpError(400, 'Place a line on the charts first');
  }

  const source = Array.isArray(laps) && laps.length > 0 ? laps : [{}];
  let cumulative = 0;
  const ranges = source.map((lap, i) => {
    const startSec = cumulative;
    const elapsed = num(lap.elapsed_time) ?? (i === source.length - 1 ? time[time.length - 1] - startSec : 0);
    cumulative += elapsed;
    return { lap, startSec, endSec: startSec + elapsed };
  });
  if (ranges.length && ranges[ranges.length - 1].endSec < time[time.length - 1]) {
    ranges[ranges.length - 1].endSec = time[time.length - 1];
  }

  const at = ranges.findIndex((r) => splitSeconds >= r.startSec && splitSeconds < r.endSec);
  if (at < 0) {
    throw httpError(400, 'Place the line on the recorded activity');
  }

  const range = ranges[at];
  if (
    splitSeconds - range.startSec < MIN_SPLIT_GAP_SEC ||
    range.endSec - splitSeconds < MIN_SPLIT_GAP_SEC
  ) {
    throw httpError(400, 'Move the line away from an existing interval');
  }

  const splitIndex = nearestIndex(time, splitSeconds);
  const startIndex = nearestIndex(time, range.startSec);
  const endIndex = at === ranges.length - 1 ? time.length : nearestIndex(time, range.endSec);
  if (splitIndex <= startIndex || splitIndex >= endIndex - 1) {
    throw httpError(400, 'Move the line away from an existing interval');
  }

  const firstElapsed = Math.round(splitSeconds - range.startSec);
  const secondElapsed = Math.round(range.endSec - range.startSec) - firstElapsed;
  const parent = range.lap;
  const first = {
    ...parent,
    ...rangeStats(streams, startIndex, splitIndex, firstElapsed),
    start_date: parent.start_date ?? null,
    start_date_local: parent.start_date_local ?? null,
  };
  const second = {
    ...parent,
    ...rangeStats(streams, splitIndex, endIndex, secondElapsed),
    start_date: addSecondsIso(parent.start_date, firstElapsed),
    start_date_local: addSecondsIso(parent.start_date_local, firstElapsed),
  };

  const next = [...source.slice(0, at), first, second, ...source.slice(at + 1)];
  return next.map((lap, i) => ({ ...lap, lap_index: i + 1, name: lap.name || `Lap ${i + 1}` }));
}
