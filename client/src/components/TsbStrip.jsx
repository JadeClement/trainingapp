import { classifyState } from '../trainingLoadSummary.js';
import { DateAxis } from './DateAxis.jsx';
import { ValueAxis, symmetricAxisTicks } from './ValueAxis.jsx';

const WIDTH = 600;
const HEIGHT = 100;
const PADDING_Y = 4;
const PADDING_X = 16;

export function TsbStrip({ data }) {
  if (data.length === 0) return null;

  const values = data.map((d) => d.tsb);
  const maxAbs = Math.max(...values.map((v) => Math.abs(v)), 10);
  const ticks = symmetricAxisTicks(maxAbs);
  const zeroY = HEIGHT / 2;
  const scale = (HEIGHT / 2 - PADDING_Y) / maxAbs;

  const innerWidth = WIDTH - PADDING_X * 2;
  const slot = innerWidth / (data.length - 1 || 1);
  const barWidth = Math.max(Math.min(slot * 0.7, innerWidth / data.length), 1.5);
  const xAt = (i) => PADDING_X + (i / (data.length - 1 || 1)) * innerWidth;
  const xPct = (i) => (xAt(i) / WIDTH) * 100;
  const yPct = (v) => ((zeroY - v * scale) / HEIGHT) * 100;

  return (
    <div className="tsb-strip">
      <div className="chart-plot-row">
        <ValueAxis ticks={ticks} yPct={yPct} />
        <div className="chart-plot">
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label="Training Stress Balance (TSB) by day">
            {ticks.map((tick) =>
              tick === 0 ? null : (
                <line
                  key={tick}
                  x1={PADDING_X}
                  y1={zeroY - tick * scale}
                  x2={WIDTH - PADDING_X}
                  y2={zeroY - tick * scale}
                  className="chart-y-grid"
                />
              )
            )}
            <line x1={PADDING_X} y1={zeroY} x2={WIDTH - PADDING_X} y2={zeroY} className="tsb-strip-zero" />
            {data.map((d, i) => {
              const { key } = classifyState(d.tsb);
              const barHeight = Math.abs(d.tsb) * scale;
              const x = Math.min(Math.max(xAt(i) - barWidth / 2, PADDING_X), WIDTH - PADDING_X - barWidth);
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
      </div>
      <DateAxis dates={data.map((d) => d.date)} xPct={xPct} />
    </div>
  );
}
