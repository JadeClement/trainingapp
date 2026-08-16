import { timeAxisTicks, formatTickMinutes } from '../streamUtils.js';

function ChartAxis({ time }) {
  if (!time || time.length === 0) return null;
  const ticks = timeAxisTicks(time);

  return (
    <div className="chart-axis">
      {ticks.map((tick) => (
        <div key={tick.seconds} className="chart-axis-tick" style={{ left: `${tick.pct}%` }}>
          <span className="chart-axis-mark" />
          <span className="chart-axis-label">{formatTickMinutes(tick.seconds)}</span>
        </div>
      ))}
    </div>
  );
}

export function ChartSection({ title, stats, note, time, children }) {
  return (
    <section className="chart-section">
      <h2 className="trend-section-title">{title}</h2>
      <div className="chart-stats">
        {stats.map((s) => (
          <div key={s.label} className="chart-stat">
            <span className="chart-stat-value">{s.value}</span>
            <span className="chart-stat-label">{s.label}</span>
          </div>
        ))}
      </div>
      {children}
      <ChartAxis time={time} />
      {note && <p className="chart-note">{note}</p>}
    </section>
  );
}
