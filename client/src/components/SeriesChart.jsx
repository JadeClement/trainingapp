const WIDTH = 600;
const HEIGHT = 130;
const PADDING = 10;

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

// A single time-series line, sharing the same width/height/padding as
// HrZoneChart so stacked charts on the workout detail page line up on a
// common x-axis.
export function SeriesChart({ values, color, invert = false, area = false }) {
  const present = values.filter((v) => v !== null && v !== undefined && !Number.isNaN(v));
  if (present.length === 0) return null;

  const min = Math.min(...present);
  const max = Math.max(...present);
  const span = max - min || 1;

  const xScale = (i) => PADDING + (i / (values.length - 1 || 1)) * (WIDTH - PADDING * 2);
  const yScale = (v) => {
    const t = (clamp(v, min, max) - min) / span;
    const flipped = invert ? 1 - t : t;
    return HEIGHT - PADDING - flipped * (HEIGHT - PADDING * 2);
  };

  // Data can have gaps (e.g. speed nulled out during stops), so the line is
  // really N disconnected segments. Build each as its own closed shape for
  // the area fill — closing the whole concatenated path in one go would let
  // SVG implicitly close each earlier segment too, stacking overlapping
  // translucent fills into uneven, blotchy patches.
  let linePath = '';
  let areaPath = '';
  let segment = [];
  let drawing = false;

  const flushSegment = () => {
    if (segment.length < 2) {
      segment = [];
      return;
    }
    const first = segment[0];
    const last = segment[segment.length - 1];
    areaPath += `M ${first.x} ${first.y} `;
    for (let i = 1; i < segment.length; i++) areaPath += `L ${segment[i].x} ${segment[i].y} `;
    areaPath += `L ${last.x} ${HEIGHT - PADDING} L ${first.x} ${HEIGHT - PADDING} Z `;
    segment = [];
  };

  values.forEach((v, i) => {
    if (v === null || v === undefined || Number.isNaN(v)) {
      drawing = false;
      flushSegment();
      return;
    }
    const point = { x: xScale(i), y: yScale(v) };
    linePath += `${drawing ? 'L' : 'M'} ${point.x} ${point.y} `;
    drawing = true;
    if (area) segment.push(point);
  });
  flushSegment();

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className="series-chart" role="img">
      {areaPath && <path d={areaPath} fill={color} opacity="0.12" stroke="none" />}
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}
