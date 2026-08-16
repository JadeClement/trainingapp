import { useState } from 'react';
import { ACTIVITY_CATEGORIES } from '../activityTypes.js';

export function ActivityTypePicker({ onSelect, onClose }) {
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const sections = ACTIVITY_CATEGORIES.map((category) => ({
    ...category,
    types: q ? category.types.filter((t) => t.toLowerCase().includes(q)) : category.types,
  })).filter((category) => category.types.length > 0);

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog activity-picker" onClick={(e) => e.stopPropagation()}>
        <div className="activity-picker-header">
          <h2>Choose activity type</h2>
          <button type="button" className="link-button" onClick={onClose}>
            Close
          </button>
        </div>
        <input
          type="text"
          className="activity-picker-search"
          placeholder="Search activities…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <div className="activity-picker-list">
          {sections.map((category) => (
            <div key={category.name} className="activity-picker-section">
              <h3>{category.name}</h3>
              <div className="activity-picker-items">
                {category.types.map((type) => (
                  <button
                    type="button"
                    key={type}
                    className="activity-picker-item"
                    onClick={() => onSelect({ sport: category.sport, activityType: type })}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {sections.length === 0 && <p className="empty-hint">No matches</p>}
        </div>
      </div>
    </div>
  );
}
