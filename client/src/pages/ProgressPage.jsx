import { useState } from 'react';
import { FitnessPage } from './FitnessPage.jsx';
import { StatsPage } from './StatsPage.jsx';

const TABS = [
  { value: 'trend', label: 'Trend' },
  { value: 'totals', label: 'Totals' },
];

export function ProgressPage({ athleteId }) {
  const [tab, setTab] = useState('trend');

  return (
    <div className="progress-page">
      <h1>Progress</h1>

      <div className="range-selector">
        {TABS.map((t) => (
          <button
            type="button"
            key={t.value}
            className={tab === t.value ? 'active' : ''}
            onClick={() => setTab(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'trend' ? <FitnessPage athleteId={athleteId} /> : <StatsPage athleteId={athleteId} />}
    </div>
  );
}
