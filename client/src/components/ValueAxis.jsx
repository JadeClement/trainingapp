function niceStep(span, targetCount) {
  const rough = span / Math.max(targetCount - 1, 1);
  if (rough <= 0 || !Number.isFinite(rough)) return 1;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const residual = rough / mag;
  const nice = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10;
  return nice * mag;
}

function formatAxisValue(value) {
  if (Math.abs(value) < 1e-9) return '0';
  if (Number.isInteger(value) || Math.abs(value - Math.round(value)) < 1e-6) {
    return String(Math.round(value));
  }
  return String(Number(value.toPrecision(4)));
}

// Round the data range out to a nice top/bottom, then place a tick on every
// step so labels cover the full plot (e.g. 387km → 0, 100, 200, 300, 400).
export function niceDomain(min, max, targetCount = 5) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: 0, max: 1, step: 1, ticks: [0, 1] };
  }
  if (max < min) [min, max] = [max, min];

  if (max === min) {
    if (max === 0) return { min: 0, max: 1, step: 1, ticks: [0, 1] };
    const pad = Math.abs(max) * 0.1 || 1;
    return niceDomain(min - pad, max + pad, targetCount);
  }

  const step = niceStep(max - min, targetCount);
  let domainMin = Math.floor(min / step + 1e-9) * step;
  let domainMax = Math.ceil(max / step - 1e-9) * step;
  if (domainMax <= domainMin) domainMax = domainMin + step;

  // Prefer starting at 0 when the data is non-negative.
  if (min >= 0 && domainMin < 0) domainMin = 0;

  const ticks = [];
  for (let v = domainMin; v <= domainMax + step * 1e-9; v += step) {
    ticks.push(Number(v.toPrecision(10)));
  }

  return { min: domainMin, max: domainMax, step, ticks };
}

export function axisTicks(min, max, targetCount = 5) {
  return niceDomain(min, max, targetCount).ticks;
}

export function symmetricAxisTicks(maxAbs, targetCount = 3) {
  const { max, ticks: pos } = niceDomain(0, maxAbs, targetCount);
  const neg = pos.filter((v) => v !== 0).map((v) => -v).reverse();
  return { ticks: [...neg, ...pos], maxAbs: max };
}

export function ValueAxis({ ticks, yPct }) {
  if (!ticks || ticks.length === 0) return null;

  return (
    <div className="chart-y-axis">
      {ticks.map((tick) => (
        <div key={tick} className="chart-y-tick" style={{ top: `${yPct(tick)}%` }}>
          <span className="chart-y-label">{formatAxisValue(tick)}</span>
          <span className="chart-y-mark" />
        </div>
      ))}
    </div>
  );
}
