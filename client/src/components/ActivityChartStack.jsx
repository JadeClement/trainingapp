import { useMemo, useRef, useState } from 'react';
import { SeriesChart } from './SeriesChart.jsx';
import { HrZoneChart } from './HrZoneChart.jsx';
import { PlusIcon } from './icons.jsx';
import { timeAxisTicks, formatTickMinutes, nearestIndex } from '../streamUtils.js';
import { laneValueYPct } from '../chartScale.js';

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

function formatElapsed(seconds) {
  if (seconds === null || seconds === undefined) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

// Keep in sync with server/src/services/lapSplit.js — a split this close to
// an existing boundary is just noise, not a new interval.
const MIN_SPLIT_GAP_SEC = 3;

// Lap boundaries as cumulative elapsed time, each mapped to the nearest
// sample index so they line up with the index-based x-scale every lane
// shares — same trick timeAxisTicks uses for the bottom axis.
function lapBoundaries(laps, time) {
  if (!laps || laps.length <= 1 || !time || time.length === 0) return [];
  let cumulative = 0;
  return laps.map((lap) => {
    const startSec = cumulative;
    cumulative += lap.elapsedSeconds ?? 0;
    return { lapIndex: lap.index, startSec, endSec: cumulative, startIndex: nearestIndex(time, startSec) };
  });
}

function intervalMarks(laps, time) {
  const marks = [0];
  let cumulative = 0;
  if (laps && laps.length > 0) {
    for (const lap of laps) {
      cumulative += lap.elapsedSeconds ?? 0;
      marks.push(cumulative);
    }
  }
  const total = time?.[time.length - 1] ?? cumulative;
  if (marks[marks.length - 1] < total) marks[marks.length - 1] = total;
  if (marks.length === 1) marks.push(total);
  return marks;
}

function canSplitAt(splitSeconds, marks) {
  if (splitSeconds == null || !Number.isFinite(splitSeconds)) return false;
  return marks.every((mark) => Math.abs(splitSeconds - mark) >= MIN_SPLIT_GAP_SEC);
}

// The workout detail page's signature element: every recorded metric
// (pace, HR, elevation, power, cadence) stacked in lockstep on one shared
// time axis. Dragging anywhere in the stack moves one cursor across every
// lane at once (they're all sampled at the same indices, so one hovered
// index drives all of them). The line stays parked on release so you can
// add an interval there; each lane keeps avg/max in its header, and the
// value at the cursor rides the scrub line on that lane's trace.
export function ActivityChartStack({ time, laps, lanes, canAddInterval = false, onAddInterval }) {
  const [cursorIndex, setCursorIndex] = useState(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(null);
  const containerRef = useRef(null);
  const pointerIdRef = useRef(null);

  const boundaries = useMemo(() => lapBoundaries(laps, time), [laps, time]);
  const marks = useMemo(() => intervalMarks(laps, time), [laps, time]);
  const ticks = useMemo(() => timeAxisTicks(time), [time]);
  const lastIndex = (time?.length || 1) - 1;

  const currentLap = useMemo(() => {
    if (cursorIndex === null || !laps?.length) return null;
    const cursorSec = time[cursorIndex];
    let cumulative = 0;
    for (const lap of laps) {
      const startSec = cumulative;
      cumulative += lap.elapsedSeconds ?? 0;
      if (cursorSec >= startSec && cursorSec < cumulative) return lap;
    }
    return laps[laps.length - 1];
  }, [cursorIndex, laps, time]);

  const cursorSeconds = cursorIndex !== null ? time[cursorIndex] : null;
  const splitReady = canAddInterval && canSplitAt(cursorSeconds, marks);

  function indexFromClientX(clientX) {
    const rect = containerRef.current.getBoundingClientRect();
    const pct = clamp((clientX - rect.left) / rect.width, 0, 1);
    return Math.round(pct * lastIndex);
  }

  function handlePointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointerIdRef.current = e.pointerId;
    try {
      containerRef.current.setPointerCapture(e.pointerId);
    } catch {
      // Capture can fail if the node isn't in the tree; move/up still fire.
    }
    setError(null);
    setCursorIndex(indexFromClientX(e.clientX));
  }

  function handlePointerMove(e) {
    if (pointerIdRef.current === null) return;
    setCursorIndex(indexFromClientX(e.clientX));
  }

  function endDrag() {
    pointerIdRef.current = null;
  }

  async function handleAddInterval() {
    if (!splitReady || adding || !onAddInterval) return;
    setAdding(true);
    setError(null);
    try {
      await onAddInterval(cursorSeconds);
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  const pct = (index) => (index / lastIndex) * 100;
  const cursorPct = cursorIndex !== null ? pct(cursorIndex) : null;
  const labelSide = cursorPct !== null && cursorPct >= 80 ? 'left' : 'right';
  const timeShift =
    cursorPct === null ? undefined : cursorPct < 8 ? 'none' : cursorPct > 92 ? 'translateX(-100%)' : 'translateX(-50%)';

  const addTitle = !canAddInterval
    ? undefined
    : cursorIndex === null
      ? 'Drag the charts to place a line'
      : splitReady
        ? 'Add an interval at this line'
        : 'Move the line away from an existing interval';

  return (
    <section className="activity-chart-stack">
      <div className="activity-chart-heading">
        <h2 className="trend-section-title">Charts</h2>
        {canAddInterval && (
          <button
            type="button"
            className="activity-chart-add"
            onClick={handleAddInterval}
            disabled={!splitReady || adding}
            title={addTitle}
            aria-label={addTitle}
          >
            <PlusIcon />
          </button>
        )}
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="activity-chart-readout">
        {cursorIndex !== null ? (
          <span
            className="activity-chart-readout-live"
            style={{ left: `${cursorPct}%`, transform: timeShift }}
          >
            {formatElapsed(time[cursorIndex])}
            {currentLap && ` · Interval ${currentLap.index}`}
          </span>
        ) : (
          <span className="activity-chart-readout-idle">
            {canAddInterval
              ? 'Drag the charts to place a line, then tap + to add an interval'
              : boundaries.length > 0
                ? `${boundaries.length} intervals — drag across the charts to explore`
                : ''}
          </span>
        )}
      </div>

      <div
        className="activity-chart-lanes"
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {boundaries.slice(1).map((b) => (
          <span
            key={b.lapIndex}
            className="activity-chart-lap-divider"
            style={{ left: `${pct(b.startIndex)}%` }}
          />
        ))}

        {cursorIndex !== null && (
          <span className="activity-chart-cursor" style={{ left: `${cursorPct}%` }} />
        )}

        {lanes.map((lane) => {
          const liveValue = cursorIndex !== null ? lane.values[cursorIndex] : null;
          const hasLive =
            liveValue !== null && liveValue !== undefined && !Number.isNaN(liveValue);
          const yPct = hasLive ? laneValueYPct(lane, liveValue) : null;
          const restReadout = lane.restStats.map((s) => `${s.value} ${s.label}`).join(' · ');

          return (
            <div key={lane.key} className="activity-chart-lane">
              <div className="activity-chart-lane-header">
                <span className="activity-chart-lane-label">{lane.label}</span>
                <span className="activity-chart-lane-readout">{restReadout}</span>
              </div>
              <div className="activity-chart-lane-plot">
                {lane.maxHr ? (
                  <HrZoneChart values={lane.values} maxHr={lane.maxHr} />
                ) : (
                  <SeriesChart values={lane.values} color={lane.color} area={lane.area} invert={lane.invert} />
                )}
                {hasLive && yPct !== null && (
                  <>
                    <span
                      className="activity-chart-live-dot"
                      style={{ left: `${cursorPct}%`, top: `${yPct}%` }}
                    />
                    <span
                      className={`activity-chart-live-value is-${labelSide}`}
                      style={{ left: `${cursorPct}%`, top: `${yPct}%` }}
                    >
                      {lane.formatLive(liveValue)}
                    </span>
                  </>
                )}
              </div>
              {lane.note && <p className="chart-note">{lane.note}</p>}
            </div>
          );
        })}
      </div>

      {ticks.length > 0 && (
        <div className="chart-axis">
          {ticks.map((tick) => (
            <div key={tick.seconds} className="chart-axis-tick" style={{ left: `${tick.pct}%` }}>
              <span className="chart-axis-mark" />
              <span className="chart-axis-label">{formatTickMinutes(tick.seconds)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
