import { velocityToValue, formatPaceOrSpeed, paceOrSpeedUnit } from '../streamUtils.js';

function formatDistance(sport, meters) {
  if (meters === null || meters === undefined) return '—';
  if (sport === 'swim') return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(2)}km`;
}

function formatLapPace(sport, avgSpeedMps) {
  if (avgSpeedMps === null || avgSpeedMps === undefined) return '—';
  return formatPaceOrSpeed(sport, velocityToValue(sport, avgSpeedMps));
}

function formatLapTime(seconds) {
  if (seconds === null || seconds === undefined) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function LapsTable({ sport, laps }) {
  if (!laps || laps.length <= 1) return null;

  const showTime = laps.some((l) => l.elapsedSeconds !== null);
  const showDistance = laps.some((l) => l.distanceMeters !== null);
  const showPace = laps.some((l) => l.avgSpeedMps !== null);
  // Strava always reports a numeric elevation gain, even 0 for flat/indoor
  // activities — only worth a column when some lap actually climbed.
  const showElevation = laps.some((l) => l.elevationGainMeters);
  const showHr = laps.some((l) => l.avgHr !== null);
  const showCadence = laps.some((l) => l.avgCadence !== null);
  const showPower = laps.some((l) => l.avgWatts !== null);

  const paceLabel = paceOrSpeedUnit(sport).label;

  return (
    <section className="chart-section laps-section">
      <h2 className="trend-section-title">Intervals</h2>
      <div className="laps-table-wrap">
        <table className="laps-table">
          <thead>
            <tr>
              <th>Interval</th>
              {showTime && <th>Time</th>}
              {showPace && <th>{paceLabel}</th>}
              {showDistance && <th>Distance</th>}
              {showElevation && <th>Elevation</th>}
              {showHr && <th>HR</th>}
              {showCadence && <th>Cadence</th>}
              {showPower && <th>Power</th>}
            </tr>
          </thead>
          <tbody>
            {laps.map((lap) => (
              <tr key={lap.index}>
                <td>{lap.index}</td>
                {showTime && <td>{formatLapTime(lap.elapsedSeconds)}</td>}
                {showPace && <td>{formatLapPace(sport, lap.avgSpeedMps)}</td>}
                {showDistance && <td>{formatDistance(sport, lap.distanceMeters)}</td>}
                {showElevation && (
                  <td>{lap.elevationGainMeters !== null ? `${Math.round(lap.elevationGainMeters)}m` : '—'}</td>
                )}
                {showHr && <td>{lap.avgHr !== null ? `${Math.round(lap.avgHr)} bpm` : '—'}</td>}
                {showCadence && (
                  <td>{lap.avgCadence !== null ? `${Math.round(lap.avgCadence)} rpm` : '—'}</td>
                )}
                {showPower && <td>{lap.avgWatts !== null ? `${Math.round(lap.avgWatts)}w` : '—'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
