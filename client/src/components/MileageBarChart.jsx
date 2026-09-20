import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDistanceMeters, formatDurationSeconds } from '../dateUtils.js';
import { formatSportForDistance } from '../activityTypes.js';
import { useSportMeta } from '../context/AuthContext.jsx';
import { ValueAxis, niceDomain } from './ValueAxis.jsx';

const WIDTH = 600;
const HEIGHT = 176;
const PADDING_X = 16;
const PADDING_TOP = 22;
const PADDING_BOTTOM = 12;
const MIN_TICK_GAP_PCT = 8;
const LABEL_MIN_BAR_WIDTH = 14;

const GRAIN_LABEL = {
  day: 'by day',
  week: 'by week',
  month: 'by month',
  year: 'by year',
};

const METRICS = [
  { value: 'distance', label: 'Mileage' },
  { value: 'duration', label: 'Hours' },
  { value: 'workouts', label: 'Workouts' },
];

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

function formatDistanceLabel(sport, meters) {
  if (!meters) return null;
  const formatted =
    formatDistanceMeters(sport, meters) ||
    (formatSportForDistance(sport) === 'swim' ? '0.000km' : '0km');
  return formatted.replace(/km$/i, '');
}

function formatHoursLabel(seconds) {
  if (!seconds) return null;
  return formatDurationSeconds(seconds);
}

function formatWorkoutsLabel(count) {
  if (!count) return null;
  return String(count);
}

function bucketMetric(bucket, sport, metric) {
  if (metric === 'duration') {
    const seconds = bucket.durations?.[sport] || 0;
    return { raw: seconds, value: seconds / 3600, label: formatHoursLabel(seconds) };
  }
  if (metric === 'workouts') {
    const count = bucket.workoutCounts?.[sport] || 0;
    return { raw: count, value: count, label: formatWorkoutsLabel(count) };
  }
  const meters = bucket.distances?.[sport] || 0;
  return {
    raw: meters,
    value: meters / 1000,
    label: formatDistanceLabel(sport, meters),
  };
}

function metricTitle(metric, sportLabel, grainLabel) {
  if (metric === 'duration') return `${sportLabel} hours ${grainLabel}`;
  if (metric === 'workouts') return `${sportLabel} workouts ${grainLabel}`;
  return `${sportLabel} mileage ${grainLabel} (km)`;
}

function emptyNote(metric, sportLabel) {
  if (metric === 'duration') return `No time logged for ${sportLabel} in this period.`;
  if (metric === 'workouts') return `No workouts logged for ${sportLabel} in this period.`;
  return `No distance logged for ${sportLabel} in this period.`;
}

function formatBucketLabel(grain, start, bucketCount) {
  const d = new Date(`${start}T00:00:00`);
  if (grain === 'year') return String(d.getFullYear());
  if (grain === 'month') return d.toLocaleDateString(undefined, { month: 'short' });
  if (grain === 'week') return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (bucketCount > 7) return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return d.toLocaleDateString(undefined, { weekday: 'short' });
}

function overlapsFocus(bucket, focusStart, focusEnd) {
  if (!focusStart || !focusEnd) return false;
  return bucket.start <= focusEnd && bucket.end >= focusStart;
}

function categoryTicks(items, xPct) {
  if (items.length === 0) return [];
  if (items.length <= 12) {
    return items.map((item, i) => ({ key: `${item.start}-${i}`, label: item.label, pct: xPct(i) }));
  }

  const last = items.length - 1;
  const interval = Math.ceil(items.length / 7);
  const ticks = [];
  for (let i = 0; i <= last; i += interval) {
    ticks.push({ key: `${items[i].start}-${i}`, label: items[i].label, pct: xPct(i) });
  }
  if (ticks[ticks.length - 1].key !== `${items[last].start}-${last}`) {
    ticks.push({ key: `${items[last].start}-${last}`, label: items[last].label, pct: xPct(last) });
  }

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

export function MileageBarChart({ series, grain, sport, focusStart, focusEnd }) {
  const plotRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(null);
  const [metric, setMetric] = useState('distance');
  const sportMeta = useSportMeta();
  const meta = sportMeta(sport);
  const color = meta.color;
  const grainLabel = GRAIN_LABEL[grain] || 'by day';

  const data = useMemo(() => {
    const buckets = series || [];
    return buckets.map((bucket) => {
      const { raw, value, label } = bucketMetric(bucket, sport, metric);
      return {
        start: bucket.start,
        end: bucket.end,
        raw,
        value,
        barLabel: label,
        label: formatBucketLabel(grain, bucket.start, buckets.length),
        isFocus: overlapsFocus(bucket, focusStart, focusEnd),
      };
    });
  }, [series, sport, grain, focusStart, focusEnd, metric]);

  useEffect(() => {
    setActiveIndex(null);
  }, [sport, series, grain, metric]);

  const totalRaw = useMemo(() => data.reduce((sum, d) => sum + d.raw, 0), [data]);

  const rawMax = Math.max(...data.map((d) => d.value), 0);
  const { max: scaleMax, ticks } = niceDomain(0, Math.max(rawMax, 1));

  const innerWidth = WIDTH - PADDING_X * 2;
  const innerHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const slot = data.length ? innerWidth / data.length : innerWidth;
  const barWidth = Math.max(Math.min(slot * 0.62, 36), 2);
  const showBarLabels = barWidth >= LABEL_MIN_BAR_WIDTH;
  const xCenter = (i) => PADDING_X + i * slot + slot / 2;
  const xPct = (i) => (xCenter(i) / WIDTH) * 100;
  const yScale = (v) => HEIGHT - PADDING_BOTTOM - (v / (scaleMax || 1)) * innerHeight;
  const yPct = (v) => (yScale(v) / HEIGHT) * 100;
  const axisTicksForPlot = categoryTicks(data, xPct);

  function indexFromClientX(clientX) {
    const plot = plotRef.current;
    if (!plot || data.length === 0) return 0;
    const rect = plot.getBoundingClientRect();
    const t = clamp((clientX - rect.left) / Math.max(rect.width, 1), 0, 0.999);
    return Math.floor(t * data.length);
  }

  if (data.length === 0) return null;

  const title = metricTitle(metric, meta.label, grainLabel);

  return (
    <div className="mileage-chart" onPointerLeave={() => setActiveIndex(null)}>
      <div className="mileage-chart-header">
        <div className="trend-section-title">{title}</div>
        <label className="mileage-metric-picker">
          <select value={metric} onChange={(e) => setMetric(e.target.value)} aria-label="Chart metric">
            {METRICS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="chart-plot-row">
        <ValueAxis ticks={ticks} yPct={yPct} />
        <div
          className="chart-plot"
          ref={plotRef}
          onPointerMove={(e) => setActiveIndex(indexFromClientX(e.clientX))}
        >
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={title}
          >
            {ticks.map((tick) => (
              <line
                key={tick}
                x1={PADDING_X}
                y1={yScale(tick)}
                x2={WIDTH - PADDING_X}
                y2={yScale(tick)}
                className="chart-y-grid"
              />
            ))}
            {data.map((d, i) => {
              const barHeight = d.value > 0 ? (d.value / (scaleMax || 1)) * innerHeight : 0;
              if (barHeight <= 0) return null;
              const isActive = i === activeIndex;
              return (
                <rect
                  key={`${d.start}-${i}`}
                  x={xCenter(i) - barWidth / 2}
                  y={yScale(d.value)}
                  width={barWidth}
                  height={barHeight}
                  rx="2"
                  fill={color}
                  opacity={d.isFocus || isActive ? 1 : 0.4}
                  className={isActive ? 'mileage-bar is-active' : 'mileage-bar'}
                />
              );
            })}
          </svg>
          {showBarLabels &&
            data.map((d, i) => {
              if (d.value <= 0) return null;
              const isActive = i === activeIndex;
              return (
                <span
                  key={`label-${d.start}-${i}`}
                  className={`mileage-bar-label${d.isFocus || isActive ? ' is-emphasis' : ''}`}
                  style={{ left: `${xPct(i)}%`, top: `${yPct(d.value)}%` }}
                >
                  {d.barLabel}
                </span>
              );
            })}
          {activeIndex != null && (
            <span className="fitness-chart-cursor" style={{ left: `${xPct(activeIndex)}%` }} />
          )}
        </div>
      </div>
      <div className="chart-axis">
        {axisTicksForPlot.map((tick) => (
          <div key={tick.key} className="chart-axis-tick" style={{ left: `${tick.pct}%` }}>
            <span className="chart-axis-mark" />
            <span className="chart-axis-label">{tick.label}</span>
          </div>
        ))}
      </div>
      {totalRaw === 0 && <p className="chart-note">{emptyNote(metric, meta.label.toLowerCase())}</p>}
    </div>
  );
}
