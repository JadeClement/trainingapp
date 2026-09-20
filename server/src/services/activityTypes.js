// Mirrors client/src/activityTypes.js so sport-pref validation and stats
// distance formatting stay aligned with the manual activity-type picker.
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

export const FEATURED_SPORT_OPTIONS = ['swim', 'bike', 'run', 'strength', 'other'];
export const DEFAULT_FEATURED_SPORTS = ['swim', 'bike', 'run'];
export const MAX_PINNED_ACTIVITY_TYPES = 5;
export const PIN_PREFIX = 'pin:';

const ACTIVITY_TYPE_SPORT = new Map();
for (const category of ACTIVITY_CATEGORIES) {
  for (const type of category.types) {
    ACTIVITY_TYPE_SPORT.set(type, category.sport);
  }
}

export const ALLOWED_ACTIVITY_TYPES = [...ACTIVITY_TYPE_SPORT.keys()];

export function sportForActivityType(activityType) {
  return ACTIVITY_TYPE_SPORT.get(activityType) || 'other';
}

export function pinKey(activityType) {
  return `${PIN_PREFIX}${activityType}`;
}

export function parsePinKey(key) {
  if (!key?.startsWith(PIN_PREFIX)) return null;
  return key.slice(PIN_PREFIX.length);
}

export function formatSportForDistance(displayKey) {
  const pinned = parsePinKey(displayKey);
  if (pinned) return sportForActivityType(pinned);
  if (FEATURED_SPORT_OPTIONS.includes(displayKey)) return displayKey;
  return 'other';
}

export function normalizeFeaturedSports(input) {
  if (!Array.isArray(input)) return null;
  const seen = new Set();
  const normalized = [];
  for (const value of input) {
    if (!FEATURED_SPORT_OPTIONS.includes(value) || seen.has(value)) continue;
    seen.add(value);
    normalized.push(value);
  }
  if (normalized.length === 0) return null;
  return FEATURED_SPORT_OPTIONS.filter((sport) => seen.has(sport));
}

export function normalizePinnedActivityTypes(input) {
  if (!Array.isArray(input)) return null;
  const seen = new Set();
  const normalized = [];
  for (const value of input) {
    if (!ACTIVITY_TYPE_SPORT.has(value) || seen.has(value)) continue;
    seen.add(value);
    normalized.push(value);
  }
  if (normalized.length > MAX_PINNED_ACTIVITY_TYPES) return null;
  return ALLOWED_ACTIVITY_TYPES.filter((type) => seen.has(type));
}

export function displayKeyForWorkout(row, featuredSports, pinnedActivityTypes) {
  const type = row.details?.activityType;
  if (type && pinnedActivityTypes.includes(type)) return pinKey(type);
  if (featuredSports.includes(row.sport)) return row.sport;
  return 'other';
}
