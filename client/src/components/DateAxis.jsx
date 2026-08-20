const TICK_INTERVAL_DAYS = [1, 2, 3, 7, 14, 30];
const MIN_TICK_GAP_PCT = 7;

function formatChartDate(isoDate) {
  const d = new Date(`${isoDate}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function pickTickInterval(dayCount) {
  return TICK_INTERVAL_DAYS.find((days) => dayCount / days <= 7) ?? 30;
}

function dedupeByPosition(ticks) {
  if (ticks.length === 0) return ticks;
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

export function dateAxisTicks(dates, xPct) {
  if (!dates || dates.length === 0) return [];
  const lastIndex = dates.length - 1;
  if (lastIndex === 0) {
    return [{ date: dates[0], label: formatChartDate(dates[0]), pct: xPct(0) }];
  }

  const interval = pickTickInterval(dates.length);
  const ticks = [];
  for (let i = 0; i <= lastIndex; i += interval) {
    ticks.push({ date: dates[i], label: formatChartDate(dates[i]), pct: xPct(i) });
  }
  if (ticks[ticks.length - 1].date !== dates[lastIndex]) {
    ticks.push({
      date: dates[lastIndex],
      label: formatChartDate(dates[lastIndex]),
      pct: xPct(lastIndex),
    });
  }
  return dedupeByPosition(ticks);
}

export function DateAxis({ dates, xPct }) {
  const ticks = dateAxisTicks(dates, xPct);
  if (ticks.length === 0) return null;

  return (
    <div className="chart-axis">
      {ticks.map((tick) => (
        <div key={tick.date} className="chart-axis-tick" style={{ left: `${tick.pct}%` }}>
          <span className="chart-axis-mark" />
          <span className="chart-axis-label">{tick.label}</span>
        </div>
      ))}
    </div>
  );
}
