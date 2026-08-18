import { sportMeta, formatDurationSeconds, toISODate } from '../dateUtils.js';

// The app's signature element: one tick per day, height mapped to that
// day's planned/actual training load, split into stacked segments colored
// by sport (sized by each sport's share of the day's duration) — a real
// read of the week's rhythm, not decoration — sits above the week view's
// day list.
export function WeekLine({ days, workoutsByDate, onSelectDay }) {
  const loads = days.map((day) => {
    const key = toISODate(day);
    const dayWorkouts = workoutsByDate[key] || [];
    const seconds = dayWorkouts.reduce(
      (sum, w) => sum + (w.actualDurationSeconds ?? w.plannedDurationSeconds ?? 0),
      0
    );

    const bySport = new Map();
    for (const w of dayWorkouts) {
      const s = w.actualDurationSeconds ?? w.plannedDurationSeconds ?? 0;
      const bucket = bySport.get(w.sport) || { seconds: 0, allDone: true };
      bucket.seconds += s;
      bucket.allDone = bucket.allDone && w.isCompleted;
      bySport.set(w.sport, bucket);
    }
    // flex-grow weight per segment — zero-duration workouts still get an
    // even split rather than disappearing entirely. Segments not yet done
    // (planned/future) get a diagonal stripe instead of a solid fill.
    const segments = [...bySport.entries()].map(([sport, bucket]) => ({
      color: sportMeta(sport).color,
      weight: bucket.seconds > 0 ? bucket.seconds : 1,
      pending: !bucket.allDone,
    }));

    return { key, seconds, segments };
  });

  const max = Math.max(...loads.map((l) => l.seconds), 1);

  return (
    <div className="week-line" role="img" aria-label="This week's planned training load by day">
      {loads.map((l) => {
        const heightPct = l.seconds > 0 ? Math.max((l.seconds / max) * 100, 12) : 6;
        return (
          <button
            type="button"
            key={l.key}
            className="week-line-tick"
            style={{ height: `${heightPct}%` }}
            title={`${l.key}${l.seconds ? ` · ${formatDurationSeconds(l.seconds)}` : ''}`}
            onClick={() => onSelectDay?.(l.key)}
          >
            {l.segments.length > 0 ? (
              l.segments.map((seg, i) => (
                <span
                  key={i}
                  className="week-line-segment"
                  style={{
                    flex: seg.weight,
                    background: seg.pending
                      ? `repeating-linear-gradient(45deg, ${seg.color}, ${seg.color} 4px, ${seg.color}55 4px, ${seg.color}55 8px)`
                      : seg.color,
                  }}
                />
              ))
            ) : (
              <span className="week-line-segment" style={{ flex: 1, background: 'var(--border)' }} />
            )}
          </button>
        );
      })}
    </div>
  );
}
