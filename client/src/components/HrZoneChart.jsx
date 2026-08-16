import { hrZoneBands } from '../streamUtils.js';

const WIDTH = 600;
const HEIGHT = 130;
const PADDING = 10;

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

// Same line-chart shape as SeriesChart, but with the heart rate zones drawn
// as colored background bands rather than a colored line — so time-in-zone
// reads at a glance without needing to decode a gradient line.
export function HrZoneChart({ values, maxHr }) {
  const present = values.filter((v) => v !== null && v !== undefined);
  if (present.length === 0) return null;

  const bands = hrZoneBands(maxHr);
  const domainMin = bands.length ? bands[0].from : Math.min(...present) - 5;
  const domainMax = bands.length ? bands[bands.length - 1].to : Math.max(...present) + 5;
  const span = domainMax - domainMin || 1;

  const xScale = (i) => PADDING + (i / (values.length - 1 || 1)) * (WIDTH - PADDING * 2);
  const yScale = (v) =>
    HEIGHT - PADDING - ((clamp(v, domainMin, domainMax) - domainMin) / span) * (HEIGHT - PADDING * 2);

  let linePath = '';
  let drawing = false;
  values.forEach((v, i) => {
    if (v === null || v === undefined) {
      drawing = false;
      return;
    }
    linePath += `${drawing ? 'L' : 'M'} ${xScale(i)} ${yScale(v)} `;
    drawing = true;
  });

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className="series-chart" role="img">
      {bands.map((b) => (
        <rect
          key={b.key}
          x={0}
          y={yScale(b.to)}
          width={WIDTH}
          height={Math.max(yScale(b.from) - yScale(b.to), 0)}
          fill={b.color}
          opacity="0.25"
        />
      ))}
      <path d={linePath} fill="none" stroke="var(--text-h)" strokeWidth="1.75" />
    </svg>
  );
}
