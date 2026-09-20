// Specific activity types grouped by category, similar to Garmin Connect's
// activity type picker. Each type maps to one of the broad `sport` enum
// buckets the backend stores (swim/bike/run/strength/other) so no schema
// change is needed — the specific label is kept in workouts.details.activityType.

export const ACTIVITY_CATEGORIES = [
  {
    name: 'Running',
    sport: 'run',
    types: ['Run', 'Trail Run', 'Track Run', 'Treadmill Run', 'Ultra Run'],
  },
  {
    name: 'Cycling',
    sport: 'bike',
    types: ['Bike', 'Indoor Cycling', 'Mountain Biking', 'Gravel Cycling', 'Track Cycling'],
  },
  {
    name: 'Swimming',
    sport: 'swim',
    types: ['Pool Swim', 'Open Water Swim'],
  },
  {
    name: 'Multisport',
    sport: 'other',
    types: ['Triathlon', 'Duathlon', 'Aquathlon', 'Brick Workout'],
  },
  {
    name: 'Fitness Equipment',
    sport: 'strength',
    types: [
      'Strength Training',
      'Yoga',
      'Pilates',
      'HIIT',
      'Cardio',
      'Elliptical',
      'Indoor Rowing',
      'Stair Stepper',
    ],
  },
  {
    name: 'Water Sports',
    sport: 'other',
    types: ['Rowing', 'Kayaking', 'Stand Up Paddleboarding', 'Surfing'],
  },
  {
    name: 'Winter Sports',
    sport: 'other',
    types: ['Cross Country Skiing', 'Alpine Skiing', 'Snowboarding', 'Snowshoeing'],
  },
  {
    name: 'Team & Racket Sports',
    sport: 'other',
    types: ['Soccer', 'Basketball', 'Tennis', 'Pickleball', 'Badminton'],
  },
  {
    name: 'Outdoor',
    sport: 'other',
    types: ['Walking', 'Hiking'],
  },
];

export const MAX_FEATURED_SPORTS = 20;
export const MAX_PINNED_ACTIVITY_TYPES = 10;
export const PIN_PREFIX = 'pin:';
export const DEFAULT_FEATURED_SPORTS = ['swim', 'bike', 'run'];
export const FEATURED_SPORT_OPTIONS = ['swim', 'bike', 'run', 'strength', 'other'];

const ACTIVITY_TYPE_SPORT = new Map();
for (const category of ACTIVITY_CATEGORIES) {
  for (const type of category.types) {
    ACTIVITY_TYPE_SPORT.set(type, category.sport);
  }
}

export function sportForActivityType(activityType) {
  return ACTIVITY_TYPE_SPORT.get(activityType) || 'other';
}

export function parsePinKey(key) {
  if (!key?.startsWith(PIN_PREFIX)) return null;
  return key.slice(PIN_PREFIX.length);
}

export function formatSportForDistance(displayKey) {
  const pinned = parsePinKey(displayKey);
  if (pinned) return sportForActivityType(pinned);
  return displayKey;
}

const PIN_COLORS = ['#c47a3a', '#3a7a8c', '#6b5b95', '#8c5a6e', '#4a7a5c'];

export function pinMeta(activityType) {
  let hash = 0;
  for (let i = 0; i < activityType.length; i++) {
    hash = (hash * 31 + activityType.charCodeAt(i)) >>> 0;
  }
  return {
    value: `${PIN_PREFIX}${activityType}`,
    label: activityType,
    color: PIN_COLORS[hash % PIN_COLORS.length],
  };
}
