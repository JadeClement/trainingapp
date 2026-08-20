import { useMemo, useRef, useState } from 'react';
import { SeriesChart } from './SeriesChart.jsx';
import { HrZoneChart } from './HrZoneChart.jsx';
import { timeAxisTicks, formatTickMinutes, nearestIndex } from '../streamUtils.js';

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

function formatElapsed(seconds) {
  if (seconds === null || seconds === undefined) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

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

// The workout detail page's signature element: every recorded metric
// (pace, HR, elevation, power, cadence) stacked in lockstep on one shared
// time axis. Dragging anywhere in the stack moves one cursor across every
// lane at once (they're all sampled at the same indices, so one hovered
// index drives all of them), and the stat readout above swaps from
// resting avg/max to live values-at-cursor plus which interval you're in.
export function ActivityChartStack({ time, laps, lanes }) {
  const [hoverIndex, setHoverIndex] = useState(null);
  const containerRef = useRef(null);
  const pointerIdRef = useRef(null);

  const boundaries = useMemo(() => lapBoundaries(laps, time), [laps, time]);
  const ticks = useMemo(() => timeAxisTicks(time), [time]);
  const lastIndex = (time?.length || 1) - 1;

  const currentLap = useMemo(() => {
    if (hoverIndex === null || boundaries.length === 0) return null;
    const hoverSec = time[hoverIndex];
    return (
      boundaries.find((b) => hoverSec >= b.startSec && hoverSec < b.endSec) ??
      boundaries[boundaries.length - 1]
    );
  }, [hoverIndex, boundaries, time]);

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
    setHoverIndex(indexFromClientX(e.clientX));
  }

  function handlePointerMove(e) {
    if (pointerIdRef.current === null) return;
    setHoverIndex(indexFromClientX(e.clientX));
  }

  function endDrag() {
    pointerIdRef.current = null;
    setHoverIndex(null);
  }

  const pct = (index) => (index / lastIndex) * 100;

  return (
    <section className="activity-chart-stack">
      <h2 className="trend-section-title">Charts</h2>

      <div className="activity-chart-readout">
        {hoverIndex !== null ? (
          <span className="activity-chart-readout-live">
            {formatElapsed(time[hoverIndex])}
            {currentLap && ` · Interval ${currentLap.lapIndex}`}
          </span>
        ) : (
          boundaries.length > 0 && (
            <span className="activity-chart-readout-idle">
              {boundaries.length} intervals — drag across the charts to explore
            </span>
          )
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

        {hoverIndex !== null && (
          <span className="activity-chart-cursor" style={{ left: `${pct(hoverIndex)}%` }} />
        )}

        {lanes.map((lane) => {
          const liveValue = hoverIndex !== null ? lane.values[hoverIndex] : null;
          const readout =
            liveValue !== null && liveValue !== undefined
              ? lane.formatLive(liveValue)
              : lane.restStats.map((s) => `${s.value} ${s.label}`).join(' · ');

          return (
            <div key={lane.key} className="activity-chart-lane">
              <div className="activity-chart-lane-header">
                <span className="activity-chart-lane-label">{lane.label}</span>
                <span className="activity-chart-lane-readout">{readout}</span>
              </div>
              {lane.maxHr ? (
                <HrZoneChart values={lane.values} maxHr={lane.maxHr} />
              ) : (
                <SeriesChart values={lane.values} color={lane.color} area={lane.area} invert={lane.invert} />
              )}
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
