import { useMemo } from 'react';
import {
  SPORTS,
  sportMeta,
  workoutDistanceMeters,
  formatDurationFraction,
  formatDistanceFraction,
  formatDistanceMeters,
} from '../dateUtils.js';

function emptyBucket(sport) {
  return {
    sport,
    doneDuration: 0,
    plannedDuration: 0,
    doneDistance: 0,
    plannedDistance: 0,
    doneCount: 0,
    plannedCount: 0,
    missingPlannedDistance: 0,
  };
}

export function summarizeWeek(workouts) {
  const bySport = new Map(SPORTS.map((s) => [s.value, emptyBucket(s.value)]));

  for (const w of workouts) {
    if (!bySport.has(w.sport)) bySport.set(w.sport, emptyBucket(w.sport));
    const bucket = bySport.get(w.sport);
    const plannedDuration = w.plannedDurationSeconds ?? (w.isCompleted ? w.actualDurationSeconds : 0) ?? 0;
    const doneDuration = w.isCompleted ? (w.actualDurationSeconds ?? w.plannedDurationSeconds ?? 0) : 0;
    const { planned, done } = workoutDistanceMeters(w);

    bucket.plannedDuration += plannedDuration;
    bucket.doneDuration += doneDuration;
    bucket.plannedDistance += planned;
    bucket.doneDistance += done;
    bucket.plannedCount += 1;
    if (w.isCompleted) bucket.doneCount += 1;
    if (!planned) bucket.missingPlannedDistance += 1;
  }

  return [...bySport.values()].filter((s) => s.plannedCount > 0);
}

function formatWeekDistance(row) {
  // A 10km plan next to two runs with no distance would look like "0 / 10 km"
  // for the whole week. Only show the planned denominator when every session
  // of this sport has a distance (an explicit plan, or actual once completed).
  if (row.missingPlannedDistance > 0) {
    return formatDistanceMeters(row.sport, row.doneDistance);
  }
  return formatDistanceFraction(row.sport, row.doneDistance, row.plannedDistance);
}

export function WeekStats({ workouts }) {
  const rows = useMemo(() => summarizeWeek(workouts), [workouts]);
  if (rows.length === 0) return null;

  const totals = rows.reduce(
    (acc, s) => ({
      doneDuration: acc.doneDuration + s.doneDuration,
      plannedDuration: acc.plannedDuration + s.plannedDuration,
      doneCount: acc.doneCount + s.doneCount,
      plannedCount: acc.plannedCount + s.plannedCount,
    }),
    { doneDuration: 0, plannedDuration: 0, doneCount: 0, plannedCount: 0 }
  );

  return (
    <section className="week-stats" aria-label="Week totals">
      <h2 className="trend-section-title">Week totals</h2>
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
            {rows.map((s) => (
              <tr key={s.sport}>
                <td>
                  <span className="stats-sport-label">
                    <i className="stats-sport-dot" style={{ backgroundColor: sportMeta(s.sport).color }} />
                    {sportMeta(s.sport).label}
                  </span>
                </td>
                <td>{formatDurationFraction(s.doneDuration, s.plannedDuration) || '—'}</td>
                <td>{formatWeekDistance(s) || '—'}</td>
                <td>
                  {s.doneCount} / {s.plannedCount}
                </td>
              </tr>
            ))}
            <tr className="stats-totals-row">
              <td>Total</td>
              <td>{formatDurationFraction(totals.doneDuration, totals.plannedDuration) || '—'}</td>
              <td>—</td>
              <td>
                {totals.doneCount} / {totals.plannedCount}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
