import { useCallback, useRef, useState } from 'react';
import { api } from '../api.js';
import { velocityToValue, formatPaceOrSpeed, paceOrSpeedUnit } from '../streamUtils.js';

function formatDistance(sport, meters) {
  if (meters === null || meters === undefined) return '—';
  if (sport === 'swim') return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(2)}km`;
}

function formatLapPace(sport, avgSpeedMps) {
  if (avgSpeedMps === null || avgSpeedMps === undefined) return '—';
  return formatPaceOrSpeed(sport, velocityToValue(sport, avgSpeedMps));
}

function formatLapTime(seconds) {
  if (seconds === null || seconds === undefined) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

const LONG_PRESS_MS = 300;
const MOVE_PX = 8;
const MOVE_LISTENER = { capture: true, passive: false };
const END_LISTENER = { capture: true };

function lapIndexFromPoint(x, y) {
  const rows = document.querySelectorAll('[data-lap-index]');
  for (const row of rows) {
    const r = row.getBoundingClientRect();
    if (x >= r.left && x < r.right && y >= r.top && y < r.bottom) {
      return Number(row.dataset.lapIndex);
    }
  }
  return null;
}

function useDragMergeLaps(enabled, onDrop) {
  const [drag, setDrag] = useState(null);
  const pressRef = useRef(null);

  const cleanup = useCallback(() => {
    const p = pressRef.current;
    if (!p) return;
    clearTimeout(p.timer);
    window.removeEventListener('pointermove', p.onMove, MOVE_LISTENER);
    window.removeEventListener('pointerup', p.onUp, END_LISTENER);
    window.removeEventListener('pointercancel', p.onCancel, END_LISTENER);
    if (p.pointerId != null && p.target?.hasPointerCapture?.(p.pointerId)) {
      p.target.releasePointerCapture(p.pointerId);
    }
    document.body.style.touchAction = '';
    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';
    pressRef.current = null;
  }, []);

  const bindRow = useCallback(
    (lapIndex) => {
      if (!enabled) return {};
      return {
        'data-lap-index': lapIndex,
        onPointerDown: (e) => {
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          cleanup();

          const startX = e.clientX;
          const startY = e.clientY;
          const origin = e.currentTarget.getBoundingClientRect();
          const isTouch = e.pointerType === 'touch';
          const press = {
            dragging: false,
            pointerId: e.pointerId,
            target: e.currentTarget,
            offsetX: startX - origin.left,
            offsetY: startY - origin.top,
            width: origin.width,
          };

          const snapshot = (x, y) => {
            const overIndex = lapIndexFromPoint(x, y);
            return {
              fromIndex: lapIndex,
              x: x - press.offsetX,
              y: y - press.offsetY,
              width: press.width,
              overIndex: overIndex && overIndex !== lapIndex ? overIndex : null,
            };
          };

          const beginDrag = (x, y) => {
            if (press.dragging) return;
            press.dragging = true;
            document.body.style.touchAction = 'none';
            document.body.style.userSelect = 'none';
            document.body.style.webkitUserSelect = 'none';
            try {
              press.target.setPointerCapture(press.pointerId);
            } catch {
              // Window listeners still track the pointer if capture fails.
            }
            setDrag(snapshot(x, y));
          };

          press.onMove = (ev) => {
            const dist = Math.hypot(ev.clientX - startX, ev.clientY - startY);
            if (!press.dragging) {
              if (isTouch) {
                if (dist > MOVE_PX) cleanup();
                return;
              }
              if (dist <= MOVE_PX) return;
              beginDrag(ev.clientX, ev.clientY);
            }
            ev.preventDefault();
            setDrag(snapshot(ev.clientX, ev.clientY));
          };

          press.onUp = (ev) => {
            if (press.dragging) {
              const overIndex = lapIndexFromPoint(ev.clientX, ev.clientY);
              if (overIndex && overIndex !== lapIndex) onDrop(lapIndex, overIndex);
              setDrag(null);
            }
            cleanup();
          };

          press.onCancel = () => {
            setDrag(null);
            cleanup();
          };

          if (!isTouch) {
            document.body.style.userSelect = 'none';
            document.body.style.webkitUserSelect = 'none';
          } else {
            press.timer = setTimeout(() => beginDrag(startX, startY), LONG_PRESS_MS);
          }

          pressRef.current = press;
          window.addEventListener('pointermove', press.onMove, MOVE_LISTENER);
          window.addEventListener('pointerup', press.onUp, END_LISTENER);
          window.addEventListener('pointercancel', press.onCancel, END_LISTENER);
        },
      };
    },
    [cleanup, enabled, onDrop]
  );

  return { drag, bindRow };
}

export function LapsTable({ sport, laps, workoutId, canMerge, onLapsChange }) {
  const [error, setError] = useState(null);
  const [merging, setMerging] = useState(false);

  const handleDrop = useCallback(
    async (fromIndex, intoIndex) => {
      if (!workoutId || merging) return;
      setMerging(true);
      setError(null);
      try {
        const data = await api.mergeWorkoutLaps(workoutId, fromIndex, intoIndex);
        onLapsChange?.(data.laps);
      } catch (err) {
        setError(err.message);
      } finally {
        setMerging(false);
      }
    },
    [merging, onLapsChange, workoutId]
  );

  const { drag, bindRow } = useDragMergeLaps(Boolean(canMerge) && !merging, handleDrop);

  if (!laps || laps.length <= 1) return null;

  const showTime = laps.some((l) => l.elapsedSeconds !== null);
  const showDistance = laps.some((l) => l.distanceMeters !== null);
  const showPace = laps.some((l) => l.avgSpeedMps !== null);
  // Strava always reports a numeric elevation gain, even 0 for flat/indoor
  // activities — only worth a column when some lap actually climbed.
  const showElevation = laps.some((l) => l.elevationGainMeters);
  const showHr = laps.some((l) => l.avgHr !== null);
  const showCadence = laps.some((l) => l.avgCadence !== null);
  const showPower = laps.some((l) => l.avgWatts !== null);

  const paceLabel = paceOrSpeedUnit(sport).label;
  const dragged = drag ? laps.find((l) => l.index === drag.fromIndex) : null;

  return (
    <section className="chart-section laps-section">
      <h2 className="trend-section-title">Intervals</h2>
      {canMerge && (
        <p className="empty-hint laps-merge-hint">Drag one interval onto another to combine them.</p>
      )}
      {error && <p className="form-error">{error}</p>}
      <div className="laps-table-wrap">
        <table className="laps-table">
          <thead>
            <tr>
              <th>Interval</th>
              {showTime && <th>Time</th>}
              {showPace && <th>{paceLabel}</th>}
              {showDistance && <th>Distance</th>}
              {showElevation && <th>Elevation</th>}
              {showHr && <th>HR</th>}
              {showCadence && <th>Cadence</th>}
              {showPower && <th>Power</th>}
            </tr>
          </thead>
          <tbody>
            {laps.map((lap) => (
              <tr
                key={lap.index}
                className={[
                  canMerge ? 'is-lap-draggable' : '',
                  drag?.fromIndex === lap.index ? 'is-lap-source' : '',
                  drag?.overIndex === lap.index ? 'is-lap-drop' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                {...bindRow(lap.index)}
              >
                <td>{lap.index}</td>
                {showTime && <td>{formatLapTime(lap.elapsedSeconds)}</td>}
                {showPace && <td>{formatLapPace(sport, lap.avgSpeedMps)}</td>}
                {showDistance && <td>{formatDistance(sport, lap.distanceMeters)}</td>}
                {showElevation && (
                  <td>{lap.elevationGainMeters !== null ? `${Math.round(lap.elevationGainMeters)}m` : '—'}</td>
                )}
                {showHr && <td>{lap.avgHr !== null ? `${Math.round(lap.avgHr)} bpm` : '—'}</td>}
                {showCadence && (
                  <td>{lap.avgCadence !== null ? `${Math.round(lap.avgCadence)} rpm` : '—'}</td>
                )}
                {showPower && <td>{lap.avgWatts !== null ? `${Math.round(lap.avgWatts)}w` : '—'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dragged && (
        <div
          className="lap-drag-ghost"
          style={{ left: drag.x, top: drag.y, width: drag.width }}
        >
          Interval {dragged.index}
          {showTime ? ` · ${formatLapTime(dragged.elapsedSeconds)}` : ''}
        </div>
      )}
    </section>
  );
}
