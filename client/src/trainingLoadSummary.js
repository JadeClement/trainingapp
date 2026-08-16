// Turns the CTL/ATL/TSB series into a plain-language status line.
export function summarizeTrainingLoad(data) {
  if (data.length === 0) {
    return 'No training load data yet — connect Strava and sync to see your fitness trend.';
  }

  const latest = data[data.length - 1];
  const compareIndex = Math.max(0, data.length - 15); // ~2 weeks back
  const compare = data[compareIndex];
  const ctlDelta = latest.ctl - compare.ctl;

  let trend;
  if (Math.abs(ctlDelta) < 1) trend = 'holding steady';
  else if (ctlDelta > 0) trend = 'building';
  else trend = 'declining';

  let freshness;
  if (latest.tsb > 5) freshness = "you're fresh and well-recovered";
  else if (latest.tsb < -20) freshness = "you're carrying significant fatigue";
  else if (latest.tsb < -10) freshness = "you're carrying some fatigue";
  else freshness = 'your form is balanced';

  return `Your fitness is ${trend} (CTL ${latest.ctl.toFixed(0)}), and ${freshness} (TSB ${latest.tsb.toFixed(0)}).`;
}

// Three-state read on current form, derived from TSB alone. Thresholds are
// a starting point — tune once real usage data is in. Deliberately no red:
// "fatigued" during a training block is expected, not alarming.
export function classifyState(tsb) {
  if (tsb > 5) return { key: 'fresh', label: 'Fresh' };
  if (tsb < -10) return { key: 'fatigued', label: 'Fatigued' };
  return { key: 'building', label: 'Building' };
}
