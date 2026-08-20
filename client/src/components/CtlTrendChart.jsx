import { DateAxis } from './DateAxis.jsx';

const WIDTH = 600;
const HEIGHT = 160;
const PADDING = 16;

export function CtlTrendChart({ data }) {
  if (data.length === 0) return null;

  const values = data.map((d) => d.ctl);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 10);
  const span = max - min || 1;

  const xScale = (i) => PADDING + (i / (data.length - 1 || 1)) * (WIDTH - PADDING * 2);
  const yScale = (v) => HEIGHT - PADDING - ((v - min) / span) * (HEIGHT - PADDING * 2);
  const xPct = (i) => (xScale(i) / WIDTH) * 100;

  const linePath = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(v)}`).join(' ');
  const areaPath = `${linePath} L ${xScale(values.length - 1)} ${HEIGHT - PADDING} L ${xScale(0)} ${HEIGHT - PADDING} Z`;

  return (
    <div className="ctl-chart">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label="Chronic Training Load (CTL) trend">
        <path d={areaPath} className="ctl-chart-area" />
        <path d={linePath} className="ctl-chart-line" />
      </svg>
      <DateAxis dates={data.map((d) => d.date)} xPct={xPct} />
    </div>
  );
}
