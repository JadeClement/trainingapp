import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { SeriesChart } from '../components/SeriesChart.jsx';
import { HrZoneChart } from '../components/HrZoneChart.jsx';
import { ChartSection } from '../components/ChartSection.jsx';
import { LapsTable } from '../components/LapsTable.jsx';
import { LinkStravaDialog } from '../components/LinkStravaDialog.jsx';
import { WorkoutComments } from '../components/WorkoutComments.jsx';
import { sportMeta, formatDurationSeconds } from '../dateUtils.js';
import {
  paceOrSpeedSeries,
  paceOrSpeedUnit,
  formatPaceOrSpeed,
  average,
  maxValue,
  minValue,
  elevationGain,
} from '../streamUtils.js';

export function WorkoutDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [workout, setWorkout] = useState(null);
  const [streams, setStreams] = useState(null);
  const [laps, setLaps] = useState(null);
  const [hrZones, setHrZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showLinkDialog, setShowLinkDialog] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [workoutData, zonesData] = await Promise.all([api.getWorkout(id), api.listHrZones()]);
      setWorkout(workoutData.workout);
      setHrZones(zonesData.zones);

      if (workoutData.workout.source === 'strava_synced') {
        const [streamData, lapsData] = await Promise.all([
          api.getWorkoutStreams(id),
          api.getWorkoutLaps(id),
        ]);
        setStreams(streamData.streams);
        setLaps(lapsData.laps);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="page-loading">Loading…</p>;
  if (error) return <p className="form-error">{error}</p>;
  if (!workout) return null;

  const maxHr = hrZones.find((z) => z.sport === workout.sport)?.maxHr;

  const meta = sportMeta(workout.sport);
  const label = workout.details?.activityType || meta.label;

  return (
    <div className="workout-detail-page">
      <div className="workout-detail-header">
        <div className="workout-detail-heading">
          <h1>{workout.title}</h1>
          <p className="workout-authorship">
            created by{' '}
            {workout.createdBy === user.id
              ? 'you'
              : `coach ${workout.createdByName}`}
          </p>
          <p className="training-load-summary">
            {workout.scheduledDate} · {label}
          </p>
        </div>
        <div className="workout-detail-actions">
          <button type="button" onClick={() => navigate(`/workouts/${id}`)}>
            Edit
          </button>
          {workout.source === 'manual' && !workout.isCompleted && !workout.stravaActivityId && (
            <button type="button" onClick={() => setShowLinkDialog(true)}>
              Link to Strava activity
            </button>
          )}
          {workout.stravaActivityId && (
            <a
              className="link-button"
              href={`https://www.strava.com/activities/${workout.stravaActivityId}`}
              target="_blank"
              rel="noreferrer"
            >
              View on Strava
            </a>
          )}
        </div>
      </div>
      {(workout.plannedDurationSeconds || workout.actualDurationSeconds || workout.details?.distance) && (
        <div className="workout-detail-summary">
          {workout.plannedDurationSeconds && (
            <div className="chart-stat">
              <span className="chart-stat-value">
                {formatDurationSeconds(workout.plannedDurationSeconds)}
              </span>
              <span className="chart-stat-label">Planned</span>
            </div>
          )}
          {workout.actualDurationSeconds && (
            <div className="chart-stat">
              <span className="chart-stat-value">
                {formatDurationSeconds(workout.actualDurationSeconds)}
              </span>
              <span className="chart-stat-label">Duration</span>
            </div>
          )}
          {workout.details?.distance && (
            <div className="chart-stat">
              <span className="chart-stat-value">{workout.details.distance}</span>
              <span className="chart-stat-label">Distance</span>
            </div>
          )}
        </div>
      )}

      {workout.notes && (
        <div className="workout-notes">
          <h2 className="trend-section-title">Notes</h2>
          <p className="workout-notes-body">{workout.notes}</p>
        </div>
      )}

      {workout.source !== 'strava_synced' && (
        <p className="empty-hint">This workout was entered manually, so there's no recorded data to chart.</p>
      )}

      {workout.source === 'strava_synced' && streams && (
        <StreamCharts sport={workout.sport} streams={streams} maxHr={maxHr} />
      )}

      {workout.source === 'strava_synced' && laps && <LapsTable sport={workout.sport} laps={laps} />}

      <WorkoutComments workoutId={id} workoutOwnerId={workout.userId} />

      {showLinkDialog && (
        <LinkStravaDialog
          workoutId={id}
          onClose={() => setShowLinkDialog(false)}
          onLinked={() => {
            setShowLinkDialog(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function StreamCharts({ sport, streams, maxHr }) {
  const hasAnyStream = Object.keys(streams).length > 0;
  if (!hasAnyStream) {
    return <p className="empty-hint">No detailed data available for this workout.</p>;
  }

  const time = streams.time?.data ?? streams.time;
  const velocity = streams.velocity_smooth?.data ?? streams.velocity_smooth;
  const heartrate = streams.heartrate?.data ?? streams.heartrate;
  const altitude = streams.altitude?.data ?? streams.altitude;
  const watts = streams.watts?.data ?? streams.watts;
  const cadence = streams.cadence?.data ?? streams.cadence;
  const moving = streams.moving?.data ?? streams.moving;

  const showPace = sport !== 'strength' && sport !== 'other' && Array.isArray(velocity);
  const showPower = sport === 'bike' && Array.isArray(watts);
  const showCadence = !showPower && Array.isArray(cadence);

  return (
    <>
      {showPace && <PaceSection sport={sport} velocity={velocity} moving={moving} time={time} />}

      {Array.isArray(heartrate) && (
        <HeartRateSection heartrate={heartrate} maxHr={maxHr} sport={sport} time={time} />
      )}

      {Array.isArray(altitude) && <ElevationSection altitude={altitude} time={time} />}

      {showPower && (
        <NumericSection title="Power" unit="w" values={watts} color="var(--first-light)" time={time} />
      )}
      {showCadence && (
        <NumericSection title="Cadence" unit="rpm" values={cadence} color="var(--building)" time={time} />
      )}
    </>
  );
}

function PaceSection({ sport, velocity, moving, time }) {
  const values = paceOrSpeedSeries(sport, velocity, moving);
  const { label, fasterIsLower } = paceOrSpeedUnit(sport);
  const avg = average(values);
  const headline = fasterIsLower ? minValue(values) : maxValue(values);
  const headlineLabel = fasterIsLower ? 'Best' : 'Max';

  return (
    <ChartSection
      title={label}
      time={time}
      stats={[
        { label: 'Avg', value: formatPaceOrSpeed(sport, avg) },
        { label: headlineLabel, value: formatPaceOrSpeed(sport, headline) },
      ]}
    >
      <SeriesChart values={values} color="var(--accent)" invert={fasterIsLower} area />
    </ChartSection>
  );
}

function HeartRateSection({ heartrate, maxHr, sport, time }) {
  const avg = average(heartrate);
  const max = maxValue(heartrate);
  const label = sportMeta(sport).label.toLowerCase();

  return (
    <ChartSection
      title="Heart rate"
      time={time}
      stats={[
        { label: 'Avg', value: avg ? `${Math.round(avg)} bpm` : '—' },
        { label: 'Max', value: max ? `${Math.round(max)} bpm` : '—' },
      ]}
      note={
        !maxHr && (
          <>
            Set your max heart rate for {label} in <Link to="/settings">Settings</Link> to see zone
            bands.
          </>
        )
      }
    >
      {maxHr ? (
        <HrZoneChart values={heartrate} maxHr={maxHr} />
      ) : (
        <SeriesChart values={heartrate} color="var(--building)" />
      )}
    </ChartSection>
  );
}

function ElevationSection({ altitude, time }) {
  const gain = elevationGain(altitude);
  const max = maxValue(altitude);

  return (
    <ChartSection
      title="Elevation"
      time={time}
      stats={[
        { label: 'Gain', value: `${Math.round(gain)}m` },
        { label: 'Max', value: max !== null ? `${Math.round(max)}m` : '—' },
      ]}
    >
      <SeriesChart values={altitude} color="var(--fresh)" area />
    </ChartSection>
  );
}

function NumericSection({ title, unit, values, color, time }) {
  const avg = average(values);
  const max = maxValue(values);

  return (
    <ChartSection
      title={title}
      time={time}
      stats={[
        { label: 'Avg', value: avg !== null ? `${Math.round(avg)}${unit}` : '—' },
        { label: 'Max', value: max !== null ? `${Math.round(max)}${unit}` : '—' },
      ]}
    >
      <SeriesChart values={values} color={color} />
    </ChartSection>
  );
}
