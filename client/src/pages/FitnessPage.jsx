import { useEffect, useState, useMemo } from 'react';
import { api } from '../api.js';
import { CtlTrendChart } from '../components/CtlTrendChart.jsx';
import { TsbStrip } from '../components/TsbStrip.jsx';
import { summarizeTrainingLoad, classifyState } from '../trainingLoadSummary.js';
import { toISODate, addDays } from '../dateUtils.js';

const FETCH_RANGE_DAYS = 90;
const RANGE_OPTIONS = [
  { label: '2 Weeks', days: 14 },
  { label: 'Month', days: 30 },
  { label: '3 Months', days: 90 },
];

export function FitnessPage({ athleteId }) {
  const [rangeDays, setRangeDays] = useState(30);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const start = toISODate(addDays(new Date(), -FETCH_RANGE_DAYS));
    const end = toISODate(new Date());
    setLoading(true);
    api
      .listTrainingLoad(start, end, athleteId)
      .then((res) => setData(res.trainingLoad))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [athleteId]);

  const latest = data[data.length - 1];
  const trendData = useMemo(() => data.slice(-rangeDays), [data, rangeDays]);

  if (loading) return <p className="page-loading">Loading…</p>;

  return (
    <div className="fitness-page">
      {error && <p className="form-error">{error}</p>}

      <StatusCard data={data} latest={latest} />

      {latest && (
        <div className="trend-view">
          <div className="range-selector">
            {RANGE_OPTIONS.map((opt) => (
              <button
                type="button"
                key={opt.days}
                className={rangeDays === opt.days ? 'active' : ''}
                onClick={() => setRangeDays(opt.days)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <h2 className="trend-section-title">Chronic Training Load (CTL)</h2>
          <CtlTrendChart data={trendData} />

          <h2 className="trend-section-title">Training Stress Balance (TSB)</h2>
          <TsbStrip data={trendData} />
          <div className="tsb-strip-legend">
            <span>
              <i className="chart-swatch tsb-bar-fresh" /> Fresh
            </span>
            <span>
              <i className="chart-swatch tsb-bar-building" /> Building
            </span>
            <span>
              <i className="chart-swatch tsb-bar-fatigued" /> Fatigued
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusCard({ data, latest }) {
  if (!latest) {
    return (
      <p className="training-load-summary">
        No training load data yet — connect Strava and sync to see your fitness trend.
      </p>
    );
  }

  const state = classifyState(latest.tsb);

  return (
    <div className={`fitness-status-card state-${state.key}`}>
      <div className="fitness-status-label">{state.label}</div>
      <p className="training-load-summary">{summarizeTrainingLoad(data)}</p>
    </div>
  );
}
