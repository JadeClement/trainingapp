import { sportMeta, formatDurationSeconds, toISODate } from '../dateUtils.js';

// The app's signature element: one tick per day, height mapped to that
// day's planned/actual training load, colored by sport. A real read of the
// week's rhythm, not decoration — sits above the week view's day list.
export function WeekLine({ days, workoutsByDate, onSelectDay }) {
  const loads = days.map((day) => {
    const key = toISODate(day);
    const dayWorkouts = workoutsByDate[key] || [];
    const seconds = dayWorkouts.reduce(
      (sum, w) => sum + (w.actualDurationSeconds ?? w.plannedDurationSeconds ?? 0),
      0
    );
    const color = dayWorkouts.length > 0 ? sportMeta(dayWorkouts[0].sport).color : null;
    return { key, seconds, color };
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
            style={{ height: `${heightPct}%`, background: l.color || 'var(--border)' }}
            title={`${l.key}${l.seconds ? ` · ${formatDurationSeconds(l.seconds)}` : ''}`}
            onClick={() => onSelectDay?.(l.key)}
          />
        );
      })}
    </div>
  );
}
