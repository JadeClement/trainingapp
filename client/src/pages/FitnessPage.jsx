import { useEffect, useMemo, useRef, useState } from 'react';
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

// Matches CtlTrendChart / TsbStrip viewBox padding so the scrub index
// lands on the same x as the plotted points.
const PLOT_PAD_FRAC = 16 / 600;

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

function formatScrubDate(isoDate) {
  const d = new Date(`${isoDate}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatLoad(value) {
  return Number(value).toFixed(0);
}

export function FitnessPage({ athleteId }) {
  const [rangeDays, setRangeDays] = useState(30);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scrubIndex, setScrubIndex] = useState(null);
  const stackRef = useRef(null);
  const pointerIdRef = useRef(null);

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

  useEffect(() => {
    setScrubIndex(null);
  }, [rangeDays, athleteId]);

  const latest = data[data.length - 1];
  const trendData = useMemo(() => data.slice(-rangeDays), [data, rangeDays]);
  const lastIndex = Math.max(trendData.length - 1, 0);
  const activeIndex = scrubIndex == null ? lastIndex : clamp(scrubIndex, 0, lastIndex);
  const point = trendData[activeIndex];
  const pointState = point ? classifyState(point.tsb) : null;

  function indexFromClientX(clientX) {
    const plot = stackRef.current?.querySelector('.chart-plot');
    if (!plot || trendData.length === 0) return 0;
    const rect = plot.getBoundingClientRect();
    const pad = rect.width * PLOT_PAD_FRAC;
    const inner = Math.max(rect.width - pad * 2, 1);
    const t = clamp((clientX - rect.left - pad) / inner, 0, 1);
    return Math.round(t * lastIndex);
  }

  function handlePointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointerIdRef.current = e.pointerId;
    try {
      stackRef.current.setPointerCapture(e.pointerId);
    } catch {
      // Capture can fail if the node isn't in the tree; move/up still fire.
    }
    setScrubIndex(indexFromClientX(e.clientX));
  }

  function handlePointerMove(e) {
    if (e.pointerType !== 'mouse' && pointerIdRef.current === null) return;
    setScrubIndex(indexFromClientX(e.clientX));
  }

  function endScrub(e) {
    pointerIdRef.current = null;
    if (e.pointerType !== 'mouse') setScrubIndex(null);
  }

  function handlePointerLeave() {
    if (pointerIdRef.current === null) setScrubIndex(null);
  }

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

          <div
            className="fitness-trend-charts"
            ref={stackRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endScrub}
            onPointerCancel={endScrub}
            onPointerLeave={handlePointerLeave}
          >
            {point && pointState && (
              <div className="fitness-chart-readout" aria-live="polite">
                <span className="fitness-chart-readout-date">{formatScrubDate(point.date)}</span>
                <span>CTL {formatLoad(point.ctl)}</span>
                <span>ATL {formatLoad(point.atl)}</span>
                <span>TSB {formatLoad(point.tsb)}</span>
                <span>TSS {formatLoad(point.tss)}</span>
                <span className={`fitness-chart-readout-state state-${pointState.key}`}>{pointState.label}</span>
              </div>
            )}

            <h2 className="trend-section-title">Chronic Training Load (CTL)</h2>
            <CtlTrendChart data={trendData} activeIndex={activeIndex} />

            <h2 className="trend-section-title">Training Stress Balance (TSB)</h2>
            <TsbStrip data={trendData} activeIndex={activeIndex} />
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
