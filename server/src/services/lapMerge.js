function num(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function sumNullable(a, b) {
  if (num(a) === null && num(b) === null) return null;
  return (num(a) ?? 0) + (num(b) ?? 0);
}

function maxNullable(a, b) {
  if (num(a) === null) return num(b);
  if (num(b) === null) return num(a);
  return Math.max(a, b);
}

function minNullable(a, b) {
  if (num(a) === null) return num(b);
  if (num(b) === null) return num(a);
  return Math.min(a, b);
}

function timeWeight(lap) {
  return num(lap.moving_time) || num(lap.elapsed_time) || 0;
}

function weightedAvg(aVal, aWeight, bVal, bWeight) {
  const a = num(aVal);
  const b = num(bVal);
  if (a === null && b === null) return null;
  if (a === null) return b;
  if (b === null) return a;
  const total = aWeight + bWeight;
  if (total === 0) return (a + b) / 2;
  return (a * aWeight + b * bWeight) / total;
}

function earlierDate(a, b) {
  const dates = [a, b].filter(Boolean).sort();
  return dates[0] || a || b || null;
}

function mergeLapPair(into, from) {
  const elapsed = sumNullable(into.elapsed_time, from.elapsed_time);
  const moving = sumNullable(into.moving_time, from.moving_time);
  const distance = sumNullable(into.distance, from.distance);
  const speedTime = num(moving) || num(elapsed);

  return {
    ...into,
    elapsed_time: elapsed,
    moving_time: moving,
    distance,
    total_elevation_gain: sumNullable(into.total_elevation_gain, from.total_elevation_gain),
    average_speed: num(distance) !== null && speedTime ? distance / speedTime : null,
    max_speed: maxNullable(into.max_speed, from.max_speed),
    average_heartrate: weightedAvg(into.average_heartrate, timeWeight(into), from.average_heartrate, timeWeight(from)),
    max_heartrate: maxNullable(into.max_heartrate, from.max_heartrate),
    average_cadence: weightedAvg(into.average_cadence, timeWeight(into), from.average_cadence, timeWeight(from)),
    average_watts: weightedAvg(into.average_watts, timeWeight(into), from.average_watts, timeWeight(from)),
    max_watts: maxNullable(into.max_watts, from.max_watts),
    start_index: minNullable(into.start_index, from.start_index),
    end_index: maxNullable(into.end_index, from.end_index),
    start_date: earlierDate(into.start_date, from.start_date),
    start_date_local: earlierDate(into.start_date_local, from.start_date_local),
  };
}

// fromIndex/intoIndex are 1-based display indices. The dropped-on lap stays
// in place and absorbs the dragged lap; remaining laps are reindexed.
export function mergeLapsByIndex(laps, fromIndex, intoIndex) {
  if (!Array.isArray(laps) || laps.length < 2) {
    const err = new Error('Need at least two intervals to merge');
    err.status = 400;
    err.publicMessage = 'Need at least two intervals to merge';
    throw err;
  }

  const from = fromIndex - 1;
  const into = intoIndex - 1;
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(into) ||
    from < 0 ||
    into < 0 ||
    from >= laps.length ||
    into >= laps.length
  ) {
    const err = new Error('Invalid interval');
    err.status = 400;
    err.publicMessage = 'Those intervals could not be merged';
    throw err;
  }
  if (from === into) {
    const err = new Error('Cannot merge an interval into itself');
    err.status = 400;
    err.publicMessage = 'Drop an interval onto a different row to merge';
    throw err;
  }

  const merged = mergeLapPair(laps[into], laps[from]);
  const next = laps.filter((_, i) => i !== from);
  const intoAfter = from < into ? into - 1 : into;
  next[intoAfter] = merged;
  return next.map((lap, i) => ({ ...lap, lap_index: i + 1 }));
}
