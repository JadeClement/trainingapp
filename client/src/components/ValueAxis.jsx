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

export function axisTicks(min, max, targetCount = 4) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (max < min) [min, max] = [max, min];
  if (max === min) return [min];

  const step = niceStep(max - min, targetCount);
  const start = Math.ceil(min / step - 1e-9) * step;
  const ticks = [];
  for (let v = start; v <= max + step * 1e-9; v += step) {
    ticks.push(Number(v.toPrecision(10)));
  }
  return ticks;
}

export function symmetricAxisTicks(maxAbs, targetCount = 3) {
  const pos = axisTicks(0, maxAbs, targetCount);
  const neg = pos.filter((v) => v !== 0).map((v) => -v).reverse();
  return [...neg, ...pos];
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
