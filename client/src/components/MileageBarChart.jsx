import { useEffect, useMemo, useRef, useState } from 'react';
import { sportMeta, formatDistanceMeters } from '../dateUtils.js';
import { formatSportForDistance } from '../activityTypes.js';
import { ValueAxis, axisTicks } from './ValueAxis.jsx';

const WIDTH = 600;
const HEIGHT = 160;
const PADDING_X = 16;
const PADDING_Y = 12;
const MIN_TICK_GAP_PCT = 8;

const GRAIN_LABEL = {
  day: 'by day',
  week: 'by week',
  month: 'by month',
  year: 'by year',
};

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

function toChartValue(meters) {
  if (!meters) return 0;
  return meters / 1000;
}

function formatMileage(sport, meters) {
  return formatDistanceMeters(sport, meters) || (formatSportForDistance(sport) === 'swim' ? '0.000km' : '0km');
}

function formatBucketLabel(grain, start, bucketCount) {
  const d = new Date(`${start}T00:00:00`);
  if (grain === 'year') return String(d.getFullYear());
  if (grain === 'month') return d.toLocaleDateString(undefined, { month: 'short' });
  if (grain === 'week') return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (bucketCount > 7) return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return d.toLocaleDateString(undefined, { weekday: 'short' });
}

function formatReadoutDate(grain, start, end) {
  const startDate = new Date(`${start}T00:00:00`);
  if (grain === 'year') return String(startDate.getFullYear());
  if (grain === 'month') {
    return startDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }
  if (grain === 'day' || start === end) {
    return startDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }
  const endDate = new Date(`${end}T00:00:00`);
  const opts = { month: 'short', day: 'numeric' };
  return `${startDate.toLocaleDateString(undefined, opts)} – ${endDate.toLocaleDateString(undefined, opts)}`;
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
  const meta = sportMeta(sport);
  const color = meta.color;

  const data = useMemo(() => {
    const buckets = series || [];
    return buckets.map((bucket) => ({
      start: bucket.start,
      end: bucket.end,
      meters: bucket.distances?.[sport] || 0,
      value: toChartValue(bucket.distances?.[sport] || 0),
      label: formatBucketLabel(grain, bucket.start, buckets.length),
      isFocus: overlapsFocus(bucket, focusStart, focusEnd),
    }));
  }, [series, sport, grain, focusStart, focusEnd]);

  useEffect(() => {
    setActiveIndex(null);
  }, [sport, series, grain]);

  const totalMeters = useMemo(() => data.reduce((sum, d) => sum + d.meters, 0), [data]);
  const unit = 'km';
  const grainLabel = GRAIN_LABEL[grain] || 'by day';

  const rawMax = Math.max(...data.map((d) => d.value), 0);
  const domainMax = Math.max(rawMax, 1);
  const ticks = axisTicks(0, domainMax);
  const scaleMax = Math.max(domainMax, ticks[ticks.length - 1] || domainMax);

  const innerWidth = WIDTH - PADDING_X * 2;
  const innerHeight = HEIGHT - PADDING_Y * 2;
  const slot = data.length ? innerWidth / data.length : innerWidth;
  const barWidth = Math.max(Math.min(slot * 0.62, 36), 2);
  const xCenter = (i) => PADDING_X + i * slot + slot / 2;
  const xPct = (i) => (xCenter(i) / WIDTH) * 100;
  const yScale = (v) => HEIGHT - PADDING_Y - (v / (scaleMax || 1)) * innerHeight;
  const yPct = (v) => (yScale(v) / HEIGHT) * 100;
  const axisTicksForPlot = categoryTicks(data, xPct);

  const focusBucket = data.find((d) => d.isFocus);
  const hovered = activeIndex != null ? data[activeIndex] : null;
  const readout = hovered
    ? `${formatReadoutDate(grain, hovered.start, hovered.end)} · ${formatMileage(sport, hovered.meters)}`
    : focusBucket
      ? `${formatReadoutDate(grain, focusBucket.start, focusBucket.end)} · ${formatMileage(sport, focusBucket.meters)}`
      : `${formatMileage(sport, totalMeters)} total`;

  function indexFromClientX(clientX) {
    const plot = plotRef.current;
    if (!plot || data.length === 0) return 0;
    const rect = plot.getBoundingClientRect();
    const t = clamp((clientX - rect.left) / Math.max(rect.width, 1), 0, 0.999);
    return Math.floor(t * data.length);
  }

  if (data.length === 0) return null;

  return (
    <div
      className="mileage-chart"
      onPointerLeave={() => setActiveIndex(null)}
    >
      <div className="mileage-chart-header">
        <div className="trend-section-title">
          {meta.label} mileage {grainLabel} ({unit})
        </div>
        <p className="mileage-chart-readout" aria-live="polite">
          {readout}
        </p>
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
            aria-label={`${meta.label} mileage ${grainLabel}`}
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
      {totalMeters === 0 && (
        <p className="chart-note">No distance logged for {meta.label.toLowerCase()} in this period.</p>
      )}
    </div>
  );
}
