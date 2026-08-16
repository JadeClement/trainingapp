import { classifyState } from '../trainingLoadSummary.js';

const WIDTH = 600;
const HEIGHT = 100;
const PADDING = 4;

export function TsbStrip({ data }) {
  if (data.length === 0) return null;

  const values = data.map((d) => d.tsb);
  const maxAbs = Math.max(...values.map((v) => Math.abs(v)), 10);
  const zeroY = HEIGHT / 2;
  const scale = (HEIGHT / 2 - PADDING) / maxAbs;

  const barWidth = Math.max((WIDTH / data.length) * 0.7, 1.5);
  const gap = WIDTH / data.length;

  return (
    <div className="tsb-strip">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label="Form (TSB) by day">
        <line x1={0} y1={zeroY} x2={WIDTH} y2={zeroY} className="tsb-strip-zero" />
        {data.map((d, i) => {
          const { key } = classifyState(d.tsb);
          const barHeight = Math.abs(d.tsb) * scale;
          const x = i * gap + (gap - barWidth) / 2;
          const y = d.tsb >= 0 ? zeroY - barHeight : zeroY;
          return (
            <rect
              key={d.date}
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(barHeight, 1)}
              className={`tsb-bar tsb-bar-${key}`}
            />
          );
        })}
      </svg>
    </div>
  );
}
